import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import {BrowserRouter, Routes, Route } from "react-router-dom";
import Pacman from "./Pacman.jsx"
createRoot(document.getElementById('root')).render(
  <>
    <Pacman></Pacman>
  </>
)
