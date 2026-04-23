Feature: Stats
  Validate the stats page displays game history correctly

  Scenario: Stats page shows the title
    Given I am logged in as "prueba1" with password "prueba1"
    When I navigate to the stats page
    Then I should see the stats page title

  Scenario: Stats page shows summary cards
    Given I am logged in as "prueba1" with password "prueba1"
    When I navigate to the stats page
    Then I should see the games played card
    And I should see the wins card
    And I should see the losses card
    And I should see the win rate card

  Scenario: Stats page shows game history table
    Given I am logged in as "prueba1" with password "prueba1"
    When I navigate to the stats page
    Then I should see the game history table with columns for result, opponent and date