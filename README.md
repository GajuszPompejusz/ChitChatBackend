# Projekt: ChitChat
## Czat z funkcjonalnościami profilu użytkownika oraz tworzeniem pokoi rozmów

## Opis strony

Strona pozwala użytkownikom na tworzenie profili, edycję wyświetlanej nazwy oraz opisu profilu, tworzenie pokoi rozmów, dołączanie do nich, zapraszanie użytkowników oraz wysyłanie i odbieranie wiadomości na czacie pokoju.

## Uruchomienie serwera

Aby backend mógł funkcjonować należy wprowadzić do pliku `.env` dane potrzebne do połączenia się z wybranym serwerem PostgreSQL, w wypadku braku działającego serwera należy pobrać PostgreSQL na swoją maszynę i włączyć serwer, po czym wprowadzić odpowiednie dane do pliku `.env`.

Następnie w konsoli programu należy przejść do folderu, do którego pobrane zostały pliki, wprowadzić w konsoli komendę `npm install`, po zainstalowaniu się modułów należy wprowadzić `node app.js` aby serwer zaczął działać.

## Działanie skryptu

Skrypt po połączeniu z serwerem PostgreSQL sprawdza czy istnieje baza danych "chitchat", jeśli nie istnieje taka baza danych to tworzy nową, pustą bazę danych.

Ponadto skrypt obsługuje komunikację pomiędzy stroną a bazą danych za pomocą metod `GET`, `POST` oraz `PUT`, które wysyłają zapytania do bazy danych, weryfikują dostęp użytkownika do danych i zwracają odpowiednie informacje bądź komunikaty o błędach w razie niepowodzenia.
