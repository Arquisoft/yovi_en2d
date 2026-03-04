import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RegisterForm from './RegisterForm';
import Game from './Game';
import Home from './Home';
import GameFinished from "./GameFinished";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RegisterForm />} />
        <Route path="/home" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/game/finished" element={<GameFinished />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
