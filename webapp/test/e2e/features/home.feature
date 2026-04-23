Feature: Home
  Validate the home page game configuration options

  Scenario: Selecting bot mode reveals configuration panel
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    And I click the "bot" play card
    Then I should see the bot configuration panel
    And I should see the bot selector dropdown
    And I should see the board size selector

  Scenario: Selecting player mode reveals configuration panel without bot selector
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    And I click the "player" play card
    Then I should see the player configuration panel
    And I should not see the bot selector dropdown
    And I should see the board size selector

  Scenario: Toggling mode deselects the card
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    And I click the "bot" play card
    And I click the "bot" play card again
    Then I should not see the configuration panel

  Scenario: Start game navigates to game page
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    And I click the "bot" play card
    And I click the start game button
    Then I should be on the game page

  Scenario: Board size can be changed
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    And I click the "bot" play card
    And I select board size "9"
    Then the board size selector should show "9"

  Scenario: Bot type can be changed
    Given I am logged in as "prueba1" with password "prueba1"
    When I am on the home page
    And I click the "bot" play card
    And I select bot "heuristic_bot"
    Then the bot selector should show "heuristic_bot"
