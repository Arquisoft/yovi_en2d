# yovi_en2d - Game Y at UniOvi

[![Release — Test, Build, Publish, Deploy](https://github.com/arquisoft/yovi_en2d/actions/workflows/release-deploy.yml/badge.svg)](https://github.com/arquisoft/yovi_en2d/actions/workflows/release-deploy.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_en2d&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_en2d)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_en2d&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_en2d)

This project contains the **yovi_en2d lab assignment**, a distributed game platform composed of multiple services and a Rust-based game engine.

---

## 🌐 Live Systems

- 🎮 Game platform: https://gameofy.publicvm.com/
- 📚 Architecture documentation: https://arquisoft.github.io/yovi_en2d
- 🤖 Bot API (Swagger / OpenAPI docs): https://arquisoft.github.io/yovi_en2d/swagger.html

---

## 🧱 Project Architecture

The system follows a **microservices architecture** with clear separation of concerns:

- `webapp/` → React + TypeScript frontend
- `users/` → Node.js + Express user service
- `gamey/` → Rust game engine + bot system
- `gateway/` → API Gateway (single entry point)
- `docs/` → Arc42 documentation (Asciidoctor + PlantUML)

### 🔁 Request Flow
- NGINX handles HTTPS + routing
- API Gateway exposes unified API surface
- Services communicate via REST

---

## 🤖 Bot API

The Bot API enables interoperability between bots and the game engine.

### Features

- Stateless moves: `/play`
- Stateful sessions: `/games`
- Supports:
  - Built-in bots (`random_bot`, `minimax_bot`, etc.)
  - External bots via allowlist

### Documentation

👉 https://arquisoft.github.io/yovi_en2d/swagger.html

---

## 🧪 Testing Strategy

The system uses a layered testing approach:

### ✔ Unit Tests
- `users`: Jest tests
- `gamey`: Rust unit tests (`cargo test`)
- `webapp`: component tests

### ✔ End-to-End Tests (Playwright + Cucumber)

E2E tests validate full user journeys.

### Flows tested

#### Authentication
- login
- registration
- session validation

#### Gameplay
- navigate to game
- select bot + board size
- start match
- play moves

#### Bot interaction
- player move → API Gateway → gamey engine
- bot response → returned via engine
- UI updates state

---

## 📁 Project Structure

The project is divided into three main components, each in its own directory:

- `webapp/`: A frontend application built with React, Vite, and TypeScript.
- `users/`: A backend service for managing users, built with Node.js and Express.
- `gamey/`: A Rust game engine and bot service.
- `docs/`: Architecture documentation sources following Arc42 template

Each component has its own `package.json` file with the necessary scripts to run and test the application.

## 🎮 Basic Features

- User registration and login
- Game creation and bot gameplay
- Multiple AI bot strategies
- Game statistics tracking
- Persistent user data

## ⚙️ Components

### Webapp

The `webapp` is a single-page application (SPA) created with [Vite](https://vitejs.dev/) and [React](https://reactjs.org/).

- `src/App.tsx`: The main component of the application.
- `src/RegisterForm.tsx`: The component that renders the user registration form.
- `package.json`: Contains scripts to run, build, and test the webapp.
- `vite.config.ts`: Configuration file for Vite.
- `Dockerfile`: Defines the Docker image for the webapp.

### Users Service

The `users` service is a simple REST API built with [Node.js](https://nodejs.org/) and [Express](https://expressjs.com/).

- `users-service.js`: The main file for the user service. It defines an endpoint `/createuser` to handle user creation.
- `package.json`: Contains scripts to start the service.
- `Dockerfile`: Defines the Docker image for the user service.

### Gamey

The `gamey` component is a Rust-based game engine with bot support, built with [Rust](https://www.rust-lang.org/) and [Cargo](https://doc.rust-lang.org/cargo/).

- `src/main.rs`: Entry point for the application.
- `src/lib.rs`: Library exports for the gamey engine.
- `src/bot/`: Bot implementation and registry.
- `src/core/`: Core game logic including actions, coordinates, game state, and player management.
- `src/notation/`: Game notation support (YEN, YGN).
- `src/web/`: Web interface components.
- `Cargo.toml`: Project manifest with dependencies and metadata.
- `Dockerfile`: Defines the Docker image for the gamey service.

## 🚀 Running the Project

You can run this project using Docker (recommended) or locally without Docker.

### 🐳 With Docker

This is the easiest way to get the project running. You need to have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

1. **Build and run the containers:**
    From the root directory of the project, run:

```bash
docker-compose up --build
```

This command will build the Docker images for both the `webapp` and `users` services and start them.

2.**Access the application:**
- Web application: [http://localhost](http://localhost)
- User service API: [http://localhost:3000](http://localhost:3000)
- Gamey API: [http://localhost:4000](http://localhost:4000)

### 💻 Without Docker

To run the project locally without Docker, you will need to run each component in a separate terminal.

#### Prerequisites

* [Node.js](https://nodejs.org/) and npm installed.

#### 1. Running the User Service

Navigate to the `users` directory:

```bash
cd users
```

Install dependencies:

```bash
npm install
```

Run the service:

```bash
npm start
```

The user service will be available at `http://localhost:3000`.

#### 2. Running the Web Application

Navigate to the `webapp` directory:

```bash
cd webapp
```

Install dependencies:

```bash
npm install
```

Run the application:

```bash
npm run dev
```

The web application will be available at `http://localhost:5173`.

#### 3. Running the GameY application

At this moment the GameY application is not needed but once it is needed you should also start it from the command line.

## Available Scripts

Each component has its own set of scripts defined in its `package.json`. Here are some of the most important ones:

### Webapp (`webapp/package.json`)

- `npm run dev`: Starts the development server for the webapp.
- `npm test`: Runs the unit tests.
- `npm run test:e2e`: Runs the end-to-end tests.
- `npm run start:all`: A convenience script to start both the `webapp` and the `users` service concurrently.

### Users (`users/package.json`)

- `npm start`: Starts the user service.
- `npm test`: Runs the tests for the service.

### Gamey (`gamey/Cargo.toml`)

- `cargo build`: Builds the gamey application.
- `cargo test`: Runs the unit tests.
- `cargo run`: Runs the gamey application.
- `cargo doc`: Generates documentation for the GameY engine application
