Feature: Navigation
  Validate the navbar and routing between pages

  Scenario: Logged-in user sees the navbar
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    Then I should see the navbar with the username "prueba1"

  Scenario: Navigate to Stats from navbar
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    And I click the Stats nav link
    Then I should be on the stats page

  Scenario: Navigate to Game from navbar
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    And I click the Game nav link
    Then I should be on the game page

  Scenario: Logout from navbar
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    And I click the logout button
    Then I should be redirected to the login page

  Scenario: Unauthenticated user is redirected to login
    Given I navigate directly to "/home"
    Then I should be redirected to the login page
