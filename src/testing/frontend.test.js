/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

globalThis.jest = jest;

describe('Test del Frontend (script.js)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="authScreen">
        <h2 id="authTitle">Accedi a NapStop</h2>
        <input type="email" id="authEmail">
        <input type="password" id="authPassword">
        <button id="btnAuthSubmit">Accedi</button>
        <div id="authToggle">Non hai un account? <span>Registrati qui</span></div>
      </div>
      <div id="modalConfigurazione"></div>
      <select id="select-mezzo"></select>
      <select id="select-raggio"></select>
      <select id="select-notifica"></select>
      <select id="select-suoneria"></select>
    `;

    const localStorageMock = (() => {
      let store = {};
      return {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
        removeItem: jest.fn(key => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; })
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    global.google = {
      maps: {
        Map: jest.fn().mockImplementation(() => ({
          setCenter: jest.fn(),
          setZoom: jest.fn(),
        })),
        Marker: jest.fn(),
        InfoWindow: jest.fn(),
        Circle: jest.fn(),
        places: {
          Autocomplete: jest.fn()
        }
      }
    };

    const scriptPath = path.resolve(process.cwd(), 'public/script.js');
    const scriptCode = fs.readFileSync(scriptPath, 'utf8');
    
    const scriptElement = document.createElement('script');
    scriptElement.textContent = scriptCode;
    document.body.appendChild(scriptElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('cambiaModalitaAuth() deve alternare correttamente i testi tra Login e Registrazione', () => {
    expect(document.getElementById('authTitle').textContent).toBe("Accedi a NapStop");

    window.cambiaModalitaAuth();

    expect(document.getElementById('authTitle').textContent).toBe("Registrati a NapStop");
    expect(document.getElementById('btnAuthSubmit').textContent).toBe("Registrati");

    window.cambiaModalitaAuth();
    expect(document.getElementById('authTitle').textContent).toBe("Accedi a NapStop");
  });
});