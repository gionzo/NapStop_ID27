let mappa;
let infoWindow; 
let fermataCorrente = ""; 
let latCorrente = null;
let lngCorrente = null;
let cerchioSveglia = null;
let markerFermataSelezionata = null;
let markerPosizioneUtente = null;
let idTracciamentoPosizione = null;

let isLoginMode = true;
let isViaggioAttivo = false; 
let viajesCaricati = []; 
let preferiti = [];      

window.onload = function() {
    if (localStorage.getItem('token')) {
        document.getElementById('authScreen').style.display = 'none';
        ottieniConfigurazioneEAvviaMappa();
        caricaCronologia(); 
    }
}

function cambiaModalitaAuth() {
    isLoginMode = !isLoginMode;
    const title = document.getElementById('authTitle');
    const button = document.getElementById('btnAuthSubmit');
    const toggle = document.getElementById('authToggle');

    if (isLoginMode) {
        title.innerText = "Accedi a NapStop";
        button.innerText = "Accedi";
        toggle.innerHTML = "Non hai un account? <span>Registrati qui</span>";
    } else {
        title.innerText = "Registrati a NapStop";
        button.innerText = "Registrati";
        toggle.innerHTML = "Hai già un account? <span>Accedi qui</span>";
    }
}

function gestisciAutenticazione() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;

    if (!email || !password) {
        alert("Per favore, compila tutti i campi.");
        return;
    }

    const url = isLoginMode ? '/api/login' : '/api/signup';

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw new Error(err.errore) });
        }
        return res.json();
    })
    .then(data => {
        if (isLoginMode) {
            localStorage.setItem('token', data.token);
            document.getElementById('authScreen').style.display = 'none';
            ottieniConfigurazioneEAvviaMappa();
            caricaCronologia(); 
        } else {
            alert("Registrazione completata! Ora effettua l'accesso.");
            cambiaModalitaAuth();
        }
    })
    .catch(err => {
        alert("Attenzione: " + err.message);
    });
}

function ottieniConfigurazioneEAvviaMappa() {
    fetch('/api-config')
        .then(response => response.json())
        .then(config => {
            caricaScriptGoogleMaps(config.apiKey);
        })
        .catch(err => {
            console.error("Errore configurazione API:", err);
        });
}

function initMap() {
    const coordinateTrento = { lat: 46.0674, lng: 11.1267 };
    
    mappa = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: coordinateTrento,
        streetViewControl: false,
        styles: [
            { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
            { featureType: "transit.station", elementType: "all", stylers: [{ visibility: "on" }, { weight: 2 }] },
            { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#ffc107" }] }
        ]
    });

    infoWindow = new google.maps.InfoWindow();
    const service = new google.maps.places.PlacesService(mappa);

    mappa.addListener("click", function(e) {
        if (isViaggioAttivo) {
            alert("Hai già un viaggio attivo! Clicca su 'Cancella Viaggio' prima di selezionare una nuova destinazione.");
            if (e.placeId) {
                e.stop();
            }
            return;
        }

        if (e.placeId) {
            e.stop();

            const lat = e.latLng.lat();
            const lng = e.latLng.lng();

            service.getDetails({
                placeId: e.placeId,
                fields: ['name']
            }, function(place, status) {
                let nomeFermata = "Fermata Selezionata";
                if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                    nomeFermata = place.name;
                }

                const contenutoPopup = `
                    <div class="popup-content">
                        <span class="nome-fermata">${nomeFermata}</span>
                        <button class="btn-prenota" onclick="apriModal('${nomeFermata.replace(/'/g, "\\'")}', ${lat}, ${lng})">
                            prenota fermata e inizia il viaggio
                        </button>
                    </div>
                `;

                infoWindow.setContent(contenutoPopup);
                infoWindow.setPosition(e.latLng);
                infoWindow.open(mappa);
            });
        }
    });

    avviaTracciamentoPosizioneNativo();
}

function avviaTracciamentoPosizioneNativo() {
    if (navigator.geolocation) {
        idTracciamentoPosizione = navigator.geolocation.watchPosition(
            function(position) {
                const posUtente = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                if (markerPosizioneUtente) {
                    markerPosizioneUtente.setPosition(posUtente);
                } else {
                    markerPosizioneUtente = new google.maps.Marker({
                        position: posUtente,
                        map: mappa,
                        title: "La tua posizione attuale",
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: "#007bff",
                            fillOpacity: 1,
                            strokeColor: "#ffffff",
                            strokeWeight: 2
                        }
                    });
                    
                    if (!isViaggioAttivo) {
                        mappa.setCenter(posUtente);
                    }
                }
            },
            function(error) {
                console.warn("Permesso di geolocalizzazione negato o errore nel tracciamento.");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
}

function apriModal(nomeFermata, lat, lng) {
    fermataCorrente = nomeFermata; 
    latCorrente = lat;
    lngCorrente = lng;

    if(infoWindow) infoWindow.close(); 
    
    document.getElementById('select-mezzo').value = "";
    document.getElementById('select-raggio').value = "";
    document.getElementById('select-notifica').value = "";
    aggiornaOpzioniRaggio(); 
    gestisciCascata(); 

    document.getElementById('modalConfigurazione').classList.add('active');
}

function chiudiModal() {
    document.getElementById('modalConfigurazione').classList.remove('active');
}

function aggiornaOpzioniRaggio() {
    const mezzo = document.getElementById('select-mezzo').value;
    const selectRaggio = document.getElementById('select-raggio');
    
    selectRaggio.innerHTML = '<option value="">-- Seleziona Raggio --</option>';

    if (mezzo === "autobus") {
        selectRaggio.innerHTML += `
            <option value="350">350 m (circa 1 min.)</option>
            <option value="1000">1 km (circa 3 min.)</option>
            <option value="1700">1,7 km (circa 5 min.)</option>
        `;
    } else if (mezzo === "treno_regionale") {
        selectRaggio.innerHTML += `
            <option value="800">800 m (circa 1 min.)</option>
            <option value="4500">4,5 km (circa 3 min.)</option>
            <option value="17000">17 km (circa 10 min.)</option>
        `;
    } else if (mezzo === "alta_velocita") {
        selectRaggio.innerHTML += `
            <option value="900">900 m (circa 1 min.)</option>
            <option value="5500">5,5 km (circa 3 min.)</option>
            <option value="25000">25 km (circa 10 min.)</option>
        `;
    }
}

function gestisciCascata() {
    const mezzo = document.getElementById('select-mezzo').value;
    const raggio = document.getElementById('select-raggio').value;
    const notifica = document.getElementById('select-notifica').value;

    const secRaggio = document.getElementById('sec-raggio');
    const secNotifica = document.getElementById('sec-notifica');
    const secConferma = document.getElementById('sec-conferma');

    const selectRaggio = document.getElementById('select-raggio');
    const selectNotifica = document.getElementById('select-notifica');
    const btnConferma = document.getElementById('btn-conferma-viaggio');

    if (mezzo !== "") {
        secRaggio.classList.remove('disabled');
        selectRaggio.removeAttribute('disabled');
    } else {
        secRaggio.classList.add('disabled');
        selectRaggio.setAttribute('disabled', 'true');
        selectRaggio.value = "";
    }

    if (mezzo !== "" && raggio !== "") {
        secNotifica.classList.remove('disabled');
        selectNotifica.removeAttribute('disabled');
    } else {
        secNotifica.classList.add('disabled');
        selectNotifica.setAttribute('disabled', 'true');
        selectNotifica.value = "";
    }

    if (mezzo !== "" && raggio !== "" && notifica !== "") {
        secConferma.classList.remove('disabled');
        btnConferma.removeAttribute('disabled');
    } else {
        secConferma.classList.add('disabled');
        btnConferma.setAttribute('disabled', 'true');
    }
}

function confermaViaggio() {
    const selMezzo = document.getElementById('select-mezzo');
    const valoreMezzo = selMezzo.value;
    const testoMezzo = selMezzo.options[selMezzo.selectedIndex].text;

    const selRaggio = document.getElementById('select-raggio');
    const valoreRaggio = selRaggio.value;
    const testoRaggio = selRaggio.options[selRaggio.selectedIndex].text;

    const selNotifica = document.getElementById('select-notifica');
    const valoreNotifica = selNotifica.value;
    const testoNotifica = selNotifica.options[selNotifica.selectedIndex].text;

    const token = localStorage.getItem('token');
    if (!token) {
        alert("Sessione scaduta o non valida. Effettua nuovamente il login.");
        document.getElementById('authScreen').style.display = 'flex';
        return;
    }

    const datiViaggio = {
        destinazione: fermataCorrente,
        lat: latCorrente,
        lng: lngCorrente,
        mezzo: valoreMezzo,
        raggio: valoreRaggio,
        notifica: valoreNotifica,
        preferito: false
    };

    fetch('/api/viaggi', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(datiViaggio)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Errore durante il salvataggio del viaggio.");
        }
        return response.json();
    })
    .then(data => {
        isViaggioAttivo = true;
        
        const raggioMetri = parseFloat(valoreRaggio);
        const coordinateFermata = { lat: latCorrente, lng: lngCorrente };

        cerchioSveglia = new google.maps.Circle({
            strokeColor: "#0088ff",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#00aaff",
            fillOpacity: 0.35,
            map: mappa,
            center: coordinateFermata,
            radius: raggioMetri
        });

        markerFermataSelezionata = new google.maps.Marker({
            position: coordinateFermata,
            map: mappa,
            title: fermataCorrente
        });

        mappa.setCenter(coordinateFermata);
        mappa.setZoom(14);

        const contenutowidget = `
            <p><strong>Destinazione:</strong><br>${fermataCorrente}</p>
            <p><strong>Mezzo:</strong> ${testoMezzo}</p>
            <p><strong>Raggio sveglia:</strong> ${testoRaggio}</p>
            <p><strong>Tipo notifica:</strong> ${testoNotifica}</p>
        `;
        document.getElementById('widgetDati').innerHTML = contenutowidget;
        document.getElementById('widgetViaggio').classList.add('active');

        chiudiModal();
        caricaCronologia(); 
    })
    .catch(errore => {
        console.error(errore);
        alert("Si è verificato un errore nel salvataggio del viaggio nel database.");
    });
}

function cancellaViaggio() {
    if (confirm("Sei sicuro di voler cancellare il viaggio attualmente attivo?")) {
        isViaggioAttivo = false;
        fermataCorrente = "";
        latCorrente = null;
        lngCorrente = null;

        if (cerchioSveglia) {
            cerchioSveglia.setMap(null);
            cerchioSveglia = null;
        }

        if (markerFermataSelezionata) {
            markerFermataSelezionata.setMap(null);
            markerFermataSelezionata = null;
        }
        
        document.getElementById('widgetViaggio').classList.remove('active');
        document.getElementById('widgetDati').innerHTML = "";
    }
}

function toggleCronologia() {
    const panel = document.getElementById('panelCronologia');
    const btn = document.getElementById('btnToggleCronologia');
    
    panel.classList.toggle('active');
    
    if (panel.classList.contains('active')) {
        btn.innerText = "Nascondi Cronologia Viaggi";
        caricaCronologia();
    } else {
        btn.innerText = "Mostra Cronologia Viaggi";
    }
}

function togglePreferiti() {
    const panel = document.getElementById('panelPreferiti');
    const btn = document.getElementById('btnTogglePreferiti');
    
    panel.classList.toggle('active');
    
    if (panel.classList.contains('active')) {
        btn.innerText = "Nascondi Preferiti";
    } else {
        btn.innerText = "Mostra Preferiti";
    }
}

function caricaCronologia() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const contenitore = document.getElementById('cronologiaContenuto');

    fetch('/api/viaggi', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            document.getElementById('authScreen').style.display = 'flex';
            throw new Error("Sessione non valida. Effettua di nuovo l'accesso.");
        }
        if (!res.ok) throw new Error("Errore nel recupero della cronologia.");
        return res.json();
    })
    .then(viaggi => {
        if (!viaggi || viaggi.length === 0) {
            contenitore.innerHTML = "<p>Nessun viaggio salvato in cronologia.</p>";
            document.getElementById('preferitiContenuto').innerHTML = "<p>Nessun viaggio tra i preferiti.</p>";
            return;
        }

        viajesCaricati = viaggi; 
        preferiti = viajesCaricati.filter(v => v.preferito === true);

        let listaHtml = '<ul class="cronologia-lista">';
        viajesCaricati.forEach(v => {
            const labelMezzo = v.mezzo === 'treno_regionale' ? 'Treno Regionale' : (v.mezzo === 'alta_velocita' ? 'Treno ad Alta Velocità' : 'Autobus');
            const labelNotifica = v.notifica === 'suoneria' ? 'Suoneria Forte' : 'Solo Vibrazione';
            const labelRaggio = v.raggio >= 1000 ? `${v.raggio / 1000} km` : `${v.raggio} m`;

            const classeStellina = v.preferito ? 'stellina attiva' : 'stellina';

            listaHtml += `
                <li class="cronologia-item">
                    <span class="${classeStellina}" onclick="togglePreferito(this, '${v._id}')">★</span>
                    <strong>Destinazione:</strong> ${v.destinazione}<br>
                    <strong>Mezzo:</strong> ${labelMezzo} | 
                    <strong>Raggio:</strong> ${labelRaggio} | 
                    <strong>Sveglia:</strong> ${labelNotifica}
                </li>
            `;
        });
        listaHtml += '</ul>';
        contenitore.innerHTML = listaHtml;
        aggiornaGraficaPreferiti(); 
    })
    .catch(err => {
        console.error("Errore nel caricamento della cronologia:", err);
        contenitore.innerHTML = "<p style='color: red;'>Impossibile caricare la cronologia in questo momento.</p>";
    });
}

function togglePreferito(elementoStellina, viaggioId) {
    const token = localStorage.getItem('token');
    if (!token) return;

    const viaggio = viajesCaricati.find(v => v._id === viaggioId);
    if (!viaggio) return;

    const nuovoStatoPreferito = !viaggio.preferito;

    fetch(`/api/viaggi/${viaggioId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ preferito: nuovoStatoPreferito })
    })
    .then(res => {
        if (!res.ok) throw new Error("Impossibile salvare lo stato preferito nel database.");
        return res.json();
    })
    .then(data => {
        viaggio.preferito = nuovoStatoPreferito;
        elementoStellina.classList.toggle('attiva');

        if (nuovoStatoPreferito) {
            if (!preferiti.some(p => p._id === viaggioId)) {
                preferiti.push(viaggio);
            }
        } else {
            const index = preferiti.findIndex(p => p._id === viaggioId);
            if (index !== -1) preferiti.splice(index, 1);
        }
        
        aggiornaGraficaPreferiti();
    })
    .catch(err => {
        console.error("Errore aggiornamento preferito:", err);
        alert("Errore di sincronizzazione con il database. Riprova.");
    });
}

function aggiornaGraficaPreferiti() {
    const contenitorePreferiti = document.getElementById('preferitiContenuto');
    
    if (preferiti.length === 0) {
        contenitorePreferiti.innerHTML = "<p>Nessun viaggio tra i preferiti.</p>";
        return;
    }

    let listaHtml = '<ul class="cronologia-lista">';
    preferiti.forEach(v => {
        const labelMezzo = v.mezzo === 'treno_regionale' ? 'Treno Regionale' : (v.mezzo === 'alta_velocita' ? 'Treno ad Alta Velocità' : 'Autobus');
        const labelNotifica = v.notifica === 'suoneria' ? 'Suoneria Forte' : 'Solo Vibrazione';
        const labelRaggio = v.raggio >= 1000 ? `${v.raggio / 1000} km` : `${v.raggio} m`;

        listaHtml += `
            <li class="cronologia-item" style="border-left-color: #ffc107;">
                <strong>Destinazione:</strong> ${v.destinazione}<br>
                <strong>Mezzo:</strong> ${labelMezzo} | 
                <strong>Raggio:</strong> ${labelRaggio} | 
                <strong>Sveglia:</strong> ${labelNotifica}
            </li>
        `;
    });
    listaHtml += '</ul>';
    contenitorePreferiti.innerHTML = listaHtml;
}

document.getElementById('modalConfigurazione').addEventListener('click', function(e) {
    if (e.target === this) {
        chiudiModal();
    }
});

function caricaScriptGoogleMaps(apiKey) {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

function logout() {
    if (idTracciamentoPosizione !== null) {
        navigator.geolocation.clearWatch(idTracciamentoPosizione);
    }
    localStorage.removeItem('token'); 
    location.reload(); 
}
