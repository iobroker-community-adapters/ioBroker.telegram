var systemDictionary = {
    "Message ignored: ": {
        "en": "Message ignored: ",
        "de": "Meldung wurde ignoriert: ",
        "ru": "Сообщение проигнорировано: ",
        "pt": "Mensagem ignorada: ",
        "nl": "Bericht genegeerd: ",
        "fr": "Message ignoré: ",
        "it": "Messaggio ignorato: ",
        "es": "Mensaje ignorado: ",
        "pl": "Wiadomość została zignorowana: "
    },
    "Welcome ": {
        "en": "Welcome ",
        "de": "Hallo ",
        "ru": "Добро пожаловать ",
        "pt": "Bem vinda ",
        "nl": "Welkom ",
        "fr": "Bienvenue ",
        "it": "benvenuto ",
        "es": "Bienvenido ",
        "pl": "Witamy "
    },
    "Restarting...": {
        "en": "Restarting...",
        "de": "Bot wird neu gestartet.",
        "ru": "Перезапуск бота.",
        "pt": "Reiniciar ...",
        "nl": "Het opnieuw starten ...",
        "fr": "Redémarrer ...",
        "it": "Riavvio ...",
        "es": "Reiniciando ...",
        "pl": "Ponowne uruchamianie ..."
    },
    "Started!": {
        "en": "Started!",
        "de": "Gestartet.",
        "ru": "Бот запущен.",
        "pt": "Começado!",
        "nl": "Begonnen!",
        "fr": "Commencé!",
        "it": "Iniziato!",
        "es": "¡Empezado!",
        "pl": "Rozpoczęty!"
    },
    "Please enter password in form \"/password phrase\"": {
        "en": "Please enter password in form \"/password phrase\"",
        "de": "Bitte geben Sie das Kennwort ein: \"/password phrase\"",
        "ru": "Пожалуйста введите пароль: \"/password phrase\"",
        "pt": "Digite a senha no formulário \"/ frase de senha\"",
        "nl": "Voer een wachtwoord in het formulier \"/ wachtwoord zin\"",
        "fr": "Veuillez entrer le mot de passe dans le formulaire \"/mot de passe\"",
        "it": "Per favore inserisci la password nel modulo \"/ frase password\"",
        "es": "Por favor, introduzca la contraseña en el formulario \"/frase de contraseña\"",
        "pl": "Proszę podać hasło w formularzu \"/hasło zwrotne\""
    },
    "Invalid password": {
        "en": "Invalid password!",
        "de": "Ungültiges Passwort!",
        "ru": "Неверный пароль!",
        "pt": "Senha inválida!",
        "nl": "Ongeldig wachtwoord!",
        "fr": "Mot de passe incorrect!",
        "it": "Password non valida!",
        "es": "¡Contraseña invalida!",
        "pl": "Nieprawidłowe hasło!"
    },
    "Restarting... Reauthenticate!": {
        "en": "Restarting... Re-authenticate!",
        "de": "Neustart ... Re-authentifizieren!",
        "ru": "Перезапуск ... Повторно аутентифицировать!",
        "pt": "Reiniciar ... Re-autenticar!",
        "nl": "Opnieuw opstarten ... Opnieuw verifiëren!",
        "fr": "Redémarrer ... Ré-authentifier!",
        "it": "Riavvio ... Re-authenticate!",
        "es": "Reiniciando ... ¡Vuelve a autenticarte!",
        "pl": "Restartowanie ... Ponownie uwierzytelnij!"
    }
};

module.exports = function (text, lang) {
    if (systemDictionary[text]) {
        return systemDictionary[text][lang] || systemDictionary[text].en || text;
    } else {
        return text;
    }
};