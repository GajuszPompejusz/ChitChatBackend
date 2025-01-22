# Projekt: ChitChat
 Czat z funkcjonalnościami profilu użytkownika oraz tworzeniem pokoi rozmów

FrontEnd: [chit-chat-front](https://github.com/sw7105/chit-chat-front)


## Opis strony

Strona pozwala użytkownikom na tworzenie profili, edycję wyświetlanej nazwy oraz opisu profilu, tworzenie pokoi rozmów, dołączanie do nich, zapraszanie użytkowników oraz wysyłanie i odbieranie wiadomości na czacie pokoju.

## Uruchomienie serwera

Aby backend mógł funkcjonować należy wprowadzić do pliku `.env` dane potrzebne do połączenia się z wybranym serwerem PostgreSQL, w wypadku braku działającego serwera należy pobrać PostgreSQL na swoją maszynę i włączyć serwer, po czym wprowadzić odpowiednie dane do pliku `.env`.

Następnie w konsoli programu należy przejść do folderu, do którego pobrane zostały pliki, wprowadzić w konsoli komendę `npm install`, po zainstalowaniu się modułów należy wprowadzić `node app.js` aby serwer zaczął działać.

## Działanie skryptu

Skrypt po połączeniu z serwerem PostgreSQL sprawdza czy istnieje baza danych "chitchat", jeśli nie istnieje taka baza danych to tworzy nową, pustą bazę danych.

Ponadto skrypt obsługuje komunikację pomiędzy stroną a bazą danych za pomocą metod `GET`, `POST` oraz `PUT`, które wysyłają zapytania do bazy danych, weryfikują dostęp użytkownika do danych i zwracają odpowiednie informacje bądź komunikaty o błędach w razie niepowodzenia.

## Dostępne metody API
### Metody GET

`/session` - Sprawdza czy użytkownik jest zalogowany

`/logout` - Wylogowywuje użytkownika

`/profile` - Pokazuje nazwę i opis użytkownika

`/room` - Zwraca listę użytowników w danym pokoju

`/rooms` - Zwraca listę pokoi, do których należy użytkownik

`/invite` - Podaje kod dołączenia do pokoju

`/read` - Odczytuje wiadomości wysłane na czacie

### Metody POST

`/login` - Weryfikuje wprowadzone dane i loguje użytkownika

`/register` - Rejestruje nowego użytkownika i loguje go na nowo założone konto

`/room` - Tworzy nowy pokój

`/invite` - Generuje nowy kod dołączenia do pokoju i podaje go

`/join` - Dołącza do pokoju o wskazanym kodzie

`/send` - Wysyła wiadomość na czacie danego pokoju


### Metoda PUT

`/profile` - Edytuje nazwę i/lub opis użytkownika


## Technologie

- express
- express-session
- pg
- path
- pcryptjs
- dotenv
- cors
