/* =========================================
   NEXUS QR — FONCTIONS JAVASCRIPT
   Génération, téléchargement et historique.
========================================= */

// Récupération des éléments principaux.
const ecranDemarrage = document.getElementById("ecranDemarrage");
const progressionDemarrage = document.getElementById("progressionDemarrage");
const pourcentageDemarrage = document.getElementById("pourcentageDemarrage");
const etatDemarrage = document.getElementById("etatDemarrage");
const formulaireQr = document.getElementById("formulaireQr");
const zoneQr = document.getElementById("zoneQr");
const statutQr = document.getElementById("statutQr");
const messageErreur = document.getElementById("messageErreur");
const boutonTelecharger = document.getElementById("boutonTelecharger");
const boutonCopier = document.getElementById("boutonCopier");
const listeHistorique = document.getElementById("listeHistorique");
const notification = document.getElementById("notification");

// Variables qui conservent l'état du générateur.
let typeSelectionne = "texte";
let contenuActuel = "";
let dernierQr = null;
let imageSelectionnee = null;
let historique = [];

// Initialisation visuelle de l'application.
function initialiserSysteme() {
    let progression = 0;

    const intervalle = setInterval(function () {
        progression += Math.floor(Math.random() * 13) + 5;

        if (progression >= 100) {
            progression = 100;
            clearInterval(intervalle);
            etatDemarrage.textContent = "SYSTÈME PRÊT — BIENVENUE.";
            setTimeout(function () {
                ecranDemarrage.classList.add("termine");
            }, 450);
        }

        progressionDemarrage.style.width = progression + "%";
        pourcentageDemarrage.textContent = String(progression).padStart(2, "0") + "%";
    }, 120);
}

// Affichage d'une petite notification.
function afficherNotification(message) {
    notification.textContent = message;
    notification.classList.add("visible");

    setTimeout(function () {
        notification.classList.remove("visible");
    }, 2600);
}

// Changement du type de QR code.
function changerType(type) {
    typeSelectionne = type;

    document.querySelectorAll(".choix-types button").forEach(function (bouton) {
        bouton.classList.toggle("type-actif", bouton.dataset.type === type);
    });

    document.getElementById("zoneTexte").classList.toggle("masque", type !== "texte");
    document.getElementById("zoneLien").classList.toggle("masque", type !== "lien");
    document.getElementById("zonePhoto").classList.toggle("masque", type !== "photo");
    document.getElementById("zoneWifi").classList.toggle("masque", type !== "wifi");

    messageErreur.textContent = "";
}

// Écoute des boutons de sélection.
document.querySelectorAll(".choix-types button").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
        changerType(bouton.dataset.type);
    });
});

// Préparation du contenu selon le type choisi.
async function preparerContenu() {
    if (typeSelectionne === "texte") {
        const texte = document.getElementById("contenuTexte").value.trim();

        if (!texte) {
            throw new Error("Écris un texte avant de générer le QR code.");
        }

        return texte;
    }

    if (typeSelectionne === "lien") {
        const lien = document.getElementById("contenuLien").value.trim();

        if (!lien) {
            throw new Error("Ajoute une adresse web.");
        }

        let adresseValide;

        try {
            adresseValide = new URL(lien);
        } catch (erreur) {
            throw new Error("L'adresse du lien n'est pas valide.");
        }

        if (!["http:", "https:"].includes(adresseValide.protocol)) {
            throw new Error("Le lien doit commencer par http:// ou https://.");
        }

        return lien;
    }

    if (typeSelectionne === "wifi") {
        const nom = document.getElementById("nomWifi").value.trim();
        const motDePasse = document.getElementById("motDePasseWifi").value;
        const securite = document.getElementById("securiteWifi").value;
        const cache = document.getElementById("wifiCache").checked;

        if (!nom) {
            throw new Error("Indique le nom du réseau Wi-Fi.");
        }

        if (securite !== "nopass" && !motDePasse) {
            throw new Error("Ajoute le mot de passe du Wi-Fi.");
        }

        // Les caractères spéciaux doivent être échappés dans le format Wi-Fi.
        function echapperWifi(valeur) {
            return valeur.replace(/([\\;,:"])/g, "\\$1");
        }

        const mot = securite === "nopass" ? "" : echapperWifi(motDePasse);
        return "WIFI:T:" + securite + ";S:" + echapperWifi(nom) + ";P:" + mot + ";H:" + cache + ";;";
    }

    if (typeSelectionne === "photo") {
        if (!imageSelectionnee) {
            throw new Error("Choisis une image avant de générer le QR code.");
        }

        // Le QR code a une capacité limitée : on réduit fortement la photo.
        const imageReduite = await compresserImage(imageSelectionnee);
        return imageReduite;
    }

    throw new Error("Type de contenu non reconnu.");
}

// Compression d'image en JPEG base64.
function compresserImage(fichier) {
    return new Promise(function (resolve, reject) {
        const lecteur = new FileReader();

        lecteur.onload = function () {
            const image = new Image();

            image.onload = function () {
                const toile = document.createElement("canvas");
                const limite = 28;
                const rapport = Math.min(1, limite / Math.max(image.width, image.height));

                toile.width = Math.max(1, Math.round(image.width * rapport));
                toile.height = Math.max(1, Math.round(image.height * rapport));

                const contexte = toile.getContext("2d");
                contexte.drawImage(image, 0, 0, toile.width, toile.height);

                // On baisse la qualité pour obtenir une donnée plus légère.
                const resultat = toile.toDataURL("image/jpeg", 0.18);

                if (resultat.length > 2800) {
                    reject(new Error("Cette photo est trop lourde pour un QR code. Essaie une image plus simple."));
                    return;
                }

                resolve(resultat);
            };

            image.onerror = function () {
                reject(new Error("Impossible de lire cette image."));
            };

            image.src = lecteur.result;
        };

        lecteur.onerror = function () {
            reject(new Error("La lecture de l'image a échoué."));
        };

        lecteur.readAsDataURL(fichier);
    });
}

// Génération du QR code avec la bibliothèque QRCode.js.
function genererQr(contenu, ajouterHistorique = true) {
    if (typeof QRCode === "undefined") {
        throw new Error("La bibliothèque QR n'est pas chargée. Vérifie ta connexion Internet puis recharge la page.");
    }

    const taille = Number(document.getElementById("tailleQr").value);
    const couleur = document.getElementById("couleurQr").value;

    zoneQr.innerHTML = "";

    const conteneur = document.createElement("div");
    conteneur.id = "qrGenere";
    zoneQr.appendChild(conteneur);

    new QRCode(conteneur, {
        text: contenu,
        width: taille,
        height: taille,
        colorDark: couleur,
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L
    });

    contenuActuel = contenu;
    dernierQr = {
        contenu: contenu,
        type: typeSelectionne,
        date: new Date().toLocaleString("fr-FR")
    };

    boutonTelecharger.disabled = false;
    boutonCopier.disabled = false;
    statutQr.innerHTML = "<span></span> QR CODE GÉNÉRÉ AVEC SUCCÈS";

    if (ajouterHistorique) {
        enregistrerHistorique(dernierQr);
    }
}

// Envoi du formulaire.
formulaireQr.addEventListener("submit", async function (evenement) {
    evenement.preventDefault();
    messageErreur.textContent = "";

    try {
        const contenu = await preparerContenu();
        genererQr(contenu);
        afficherNotification("QR CODE GÉNÉRÉ AVEC SUCCÈS.");
    } catch (erreur) {
        messageErreur.textContent = erreur.message;
    }
});

// Lecture du fichier photo sélectionné.
document.getElementById("fichierPhoto").addEventListener("change", function (evenement) {
    imageSelectionnee = evenement.target.files[0] || null;

    if (imageSelectionnee) {
        const nom = imageSelectionnee.name;
        document.querySelector(".zone-fichier strong").textContent = nom;
        messageErreur.textContent = "";
    }
});

// Téléchargement du QR code en PNG.
boutonTelecharger.addEventListener("click", function () {
    const image = zoneQr.querySelector("canvas") || zoneQr.querySelector("img");

    if (!image) {
        afficherNotification("AUCUN QR CODE À TÉLÉCHARGER.");
        return;
    }

    const lien = document.createElement("a");
    lien.download = "nexus-qr-" + Date.now() + ".png";
    lien.href = image.tagName === "CANVAS" ? image.toDataURL("image/png") : image.src;
    lien.click();

    afficherNotification("TÉLÉCHARGEMENT LANCÉ.");
});

// Copie du contenu actuellement encodé.
boutonCopier.addEventListener("click", async function () {
    try {
        await navigator.clipboard.writeText(contenuActuel);
        afficherNotification("CONTENU COPIÉ.");
    } catch (erreur) {
        afficherNotification("COPIE NON DISPONIBLE SUR CE NAVIGATEUR.");
    }
});

// Sauvegarde de l'historique dans le navigateur.
function enregistrerHistorique(element) {
    historique.unshift(element);
    historique = historique.slice(0, 20);

    try {
        localStorage.setItem("nexusQrHistorique", JSON.stringify(historique));
    } catch (erreur) {
        // L'application continue même si le navigateur bloque le stockage.
    }

    afficherHistorique();
}

// Chargement des archives déjà enregistrées.
function chargerHistorique() {
    try {
        historique = JSON.parse(localStorage.getItem("nexusQrHistorique")) || [];
    } catch (erreur) {
        historique = [];
    }

    afficherHistorique();
}

// Affichage de la liste des QR précédents.
function afficherHistorique() {
    listeHistorique.innerHTML = "";

    if (historique.length === 0) {
        listeHistorique.innerHTML = '<div class="historique-vide">AUCUNE DONNÉE ARCHIVÉE — GÉNÈRE TON PREMIER QR CODE.</div>';
        return;
    }

    historique.forEach(function (element, index) {
        const ligne = document.createElement("div");
        ligne.className = "element-historique";

        const miniature = document.createElement("div");
        miniature.className = "miniature-historique";
        miniature.textContent = "⌗";

        const details = document.createElement("div");
        details.className = "details-historique";

        const titre = document.createElement("strong");
        titre.textContent = "QR " + element.type.toUpperCase();

        const extrait = document.createElement("small");
        extrait.textContent = element.type === "photo" ? "Image encodée — données privées" : element.contenu;

        const date = document.createElement("time");
        date.textContent = element.date;

        details.append(titre, extrait, date);

        const actions = document.createElement("div");
        actions.className = "actions-historique";

        const boutonRestaurer = document.createElement("button");
        boutonRestaurer.className = "action-historique";
        boutonRestaurer.textContent = "REFAIRE";
        boutonRestaurer.addEventListener("click", function () {
            typeSelectionne = element.type;
            changerType(element.type);
            genererQr(element.contenu, false);
            document.getElementById("generateur").scrollIntoView({ behavior: "smooth" });
        });

        const boutonSupprimer = document.createElement("button");
        boutonSupprimer.className = "action-historique action-supprimer";
        boutonSupprimer.textContent = "×";
        boutonSupprimer.setAttribute("aria-label", "Supprimer cette entrée");
        boutonSupprimer.addEventListener("click", function () {
            historique.splice(index, 1);

            try {
                localStorage.setItem("nexusQrHistorique", JSON.stringify(historique));
            } catch (erreur) {
                // On conserve l'historique en mémoire si le stockage est indisponible.
            }

            afficherHistorique();
        });

        actions.append(boutonRestaurer, boutonSupprimer);
        ligne.append(miniature, details, actions);
        listeHistorique.appendChild(ligne);
    });
}

// Suppression complète des archives.
document.getElementById("boutonEffacer").addEventListener("click", function () {
    if (!historique.length) {
        afficherNotification("L'HISTORIQUE EST DÉJÀ VIDE.");
        return;
    }

    const confirmation = confirm("Effacer tout l'historique des QR codes ?");
    if (confirmation) {
        historique = [];
        localStorage.removeItem("nexusQrHistorique");
        afficherHistorique();
        afficherNotification("HISTORIQUE EFFACÉ.");
    }
});

// Démarrage de l'application.
initialiserSysteme();
chargerHistorique();
