Feature: Game
  Validate the game board page behaviour

  Scenario: Send move button appears after game starts
    Given I am logged in as "prueba1" with password "prueba1"
    And a game is in progress with bot "random_bot" and board size "7"
    Then the send move button should be visible


  Scenario: Restart button starts a new game
    Given I am logged in as "prueba1" with password "prueba1"
    And a game is in progress with bot "random_bot" and board size "7"
    When I click the new game button
    Then the game board should be visible

