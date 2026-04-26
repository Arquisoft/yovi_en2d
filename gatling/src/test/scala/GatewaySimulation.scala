import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class GatewayFullSimulation extends Simulation {

  val baseUrl = System.getProperty("baseUrl", "https://gameofy.publicvm.com")

  val httpProtocol = http
    .baseUrl(baseUrl)
    .contentTypeHeader("application/json")
    .acceptHeader("application/json")

  val userFeeder = Iterator.continually(Map(
    "userId" -> scala.util.Random.nextInt(100000),
    "email"  -> s"gatling${scala.util.Random.nextInt(100000)}@test.com"
  ))

  // --- Scenario 1: Auth flow ---
  val authFlow = scenario("Auth Flow")
    .feed(userFeeder)
    .exec(
      http("Register")
        .post("/api/createuser")
        .body(StringBody("""{"username":"user_#{userId}","email":"#{email}","password":"Test1234!"}"""))
        .check(status.in(200, 201, 409))
    )
    .pause(1)
    .exec(
      http("Login via gateway")
        .post("/api/login")
        .body(StringBody("""{"username":"user_#{userId}","password":"Test1234!"}"""))
        .check(status.in(200, 401))
        .check(jsonPath("$.token").optional.saveAs("token"))
    )
    .pause(1)
    .doIf(session => session("token").asOption[String].isDefined) {
      exec(
        http("Verify token")
          .get("/api/verify")
          .header("Authorization", "Bearer #{token}")
          .check(status.is(200))
      )
    }

  // --- Scenario 2: Browse stats ---
  val browseFlow = scenario("Browse Stats")
    .exec(
      http("Get Ranking")
        .get("/api/ranking")
        .check(status.is(200))
    )
    .pause(1)
    .exec(
      http("Get History")
        .get("/api/history/prueba1")
        .check(status.in(200, 404))
    )

  // --- Scenario 3: Full PvB game flow ---
  val pvbGameFlow = scenario("PvB Game Flow")
    .exec(
      http("List available bots")
        .get("/api/bots")
        .check(status.is(200))
    )
    .pause(1)
    .exec(
      http("Create game")
        .post("/api/game/new")
        .body(StringBody("""{"size":7}"""))
        .check(status.is(200))
        .check(jsonPath("$.yen").saveAs("gameState"))
    )
    .pause(1)
    .doIf(session => session("gameState").asOption[String].isDefined) {
      exec(
        http("Bot choose")
          .post("/api/game/bot/choose")
          .body(StringBody("""{"yen":#{gameState},"bot":"random_bot"}"""))
          .check(status.in(200, 201))
      )
      .pause(1)
      .exec(
        http("PvB move")
          .post("/api/game/pvb/move")
          .body(StringBody("""{"yen":#{gameState},"bot":"random_bot","row":1,"col":1}"""))
          .check(status.in(200, 201))
          .check(jsonPath("$.finished").optional.saveAs("finished"))
      )
      .doIf(session => session("finished").asOption[String].contains("true")) {
        exec(
          http("Save result")
            .post("/api/gameresult")
            .body(StringBody("""{"username":"gatling_user","opponent":"random_bot","result":"win","score":10}"""))
            .check(status.in(200, 201))
        )
      }
    }

  // --- Scenario 4: Health and status checks ---
  val healthFlow = scenario("Health Checks")
    .exec(
      http("Game status")
        .get("/api/game/status")
        .check(status.is(200))
    )

  setUp(
    authFlow.inject(
      atOnceUsers(5),
      rampUsers(20).during(30.seconds),
      constantUsersPerSec(5).during(1.minute)
    ),
    browseFlow.inject(
      rampUsers(20).during(30.seconds),
      constantUsersPerSec(10).during(1.minute)
    ),
    pvbGameFlow.inject(
      rampUsers(30).during(40.seconds),
      constantUsersPerSec(10).during(1.minute)
    ),
    healthFlow.inject(
      atOnceUsers(5),
      constantUsersPerSec(5).during(1.minute)
    )
  ).protocols(httpProtocol)
}