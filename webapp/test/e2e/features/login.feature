Feature: Login
  Validate the login form and authentication flow

  Scenario: Successful login with valid credentials
    Given the login page is open
    When I enter "prueba1" as the username and "prueba1" as the password and submit
    Then I should be redirected to the home page

  Scenario: Login fails with empty username
    Given the login page is open
    When I submit the login form with username "" and password "123456"
    Then I should see a login error message

  Scenario: Login fails with empty password
    Given the login page is open
    When I submit the login form with username "Alice" and password ""
    Then I should see a login error message

  Scenario: Login fails with invalid credentials
    Given the login page is open
    When I submit the login form with username "nonexistent_user_xyz" and password "wrongpass"
    Then I should see a login error message

  Scenario: Navigate to register page from login
    Given the login page is open
    When I click the register link
    Then I should be on the register page
