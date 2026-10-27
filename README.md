# Biblioteczka

Prosta, statyczna strona systemu bibliotecznego. Projekt nie wymaga kompilacji
ani instalowania zależności.

## Struktura

```text
.
├── assets/
│   ├── favicon.svg
│   └── vendor/
│       ├── qrcode.js
│       ├── qrcode_UTF8.js
│       ├── jsQR.js
│       ├── qrcode-generator-LICENSE.txt
│       └── jsQR-LICENSE.txt
├── apps-script/
│   └── Code.gs
├── app.js
├── config.js
├── index.html
├── README.md
└── styles.css
```

## Wdrożenie strony na GitHub Pages

Projekt jest stroną statyczną: nie wymaga serwera, kompilacji, Node.js ani
instalowania pakietów. GitHub Pages publikuje pliki HTML, CSS i JavaScript
bezpośrednio z repozytorium.

### 1. Przygotuj repozytorium

1. Zaloguj się na [GitHub](https://github.com/) i utwórz nowe repozytorium
   (**New repository**).
2. Nadaj mu nazwę, na przykład `system-biblioteczny`. Dla najprostszej
   konfiguracji wybierz repozytorium **Public**.
3. Nie twórz automatycznie pliku README, jeśli zamierzasz przesłać istniejący
   plik z projektu o tej samej nazwie.
4. Dodaj do repozytorium cały projekt, zachowując jego strukturę. W katalogu
   głównym repozytorium powinny znajdować się `index.html`, `app.js`,
   `config.js`, `styles.css` i `README.md`, a obok nich foldery `assets/`
   i `apps-script/`.

Możesz dodać pliki przez **Add file → Upload files** na stronie GitHuba albo
przez Git w terminalu. Przykładowo, w PowerShellu otwartym w katalogu projektu:

```powershell
git init
git add .
git commit -m "Przygotowanie systemu bibliotecznego"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/system-biblioteczny.git
git push -u origin main
```

Zastąp `TWOJ_LOGIN` swoim loginem GitHub. Jeśli repozytorium zawiera już
commity, pomiń `git init` oraz — jeśli gałąź i zdalne repozytorium są już
skonfigurowane — odpowiednio także `git branch` i `git remote`. Przy
przesyłaniu przez przeglądarkę pamiętaj o dodaniu również plików z folderów
`assets/`, `assets/vendor/` i `apps-script/`; bez lokalnych bibliotek QR
skanowanie i drukowanie kodów nie będzie działać.

### 2. Włącz GitHub Pages

1. Otwórz repozytorium na GitHubie i przejdź do **Settings**.
2. W bocznym menu wybierz **Pages**.
3. W sekcji **Build and deployment** jako **Source** wybierz **Deploy from a
   branch**.
4. W sekcji **Branch** wybierz `main` (lub gałąź, na którą przesłałeś projekt)
   oraz folder `/(root)`.
5. Kliknij **Save**.
6. Po zakończeniu publikacji odśwież stronę **Settings → Pages**. GitHub
   wyświetli adres witryny.

Dla repozytorium projektu adres będzie zwykle miał postać
`https://TWOJ_LOGIN.github.io/system-biblioteczny/`. Strona główna musi być
plikiem `index.html` w katalogu źródłowym wybranym w ustawieniach Pages.
Publikacja może potrwać kilka minut; postęp i ewentualne błędy sprawdzisz
w zakładce **Actions** repozytorium, w zadaniu publikacji Pages.

Jeśli chcesz użyć innej nazwy repozytorium albo publikować z folderu `docs`,
zmień odpowiednio nazwę/folder w ustawieniach Pages. W tym projekcie zalecany
i opisany wariant to gałąź `main` oraz `/(root)`.

### 3. Skonfiguruj arkusz Google

#### Opublikuj arkusz jako CSV

1. W Google Sheets otwórz arkusz używany jako baza książek. W pierwszym
   wierszu umieść nagłówki: `Title`, `Author`, `Color1`, `Color2`, `Column`,
   `Row`, `Location`, `Publication date`, `Publishing house`, `Illustrator`,
   `Binder/Layer`, `status` i `Borrower`.
   Każda książka powinna zajmować jeden wiersz.
2. Wybierz **Plik → Udostępnij → Opublikuj w internecie**.
3. Wybierz właściwą zakładkę arkusza oraz format **Wartości rozdzielane
   przecinkami (.csv)** i kliknij **Opublikuj**.
4. Skopiuj opublikowany adres CSV. W `app.js` sprawdź wartość `booksUrl`
   i zastąp ją tym adresem, jeśli używasz innego arkusza. Zapisz plik
   i prześlij zmianę do GitHuba.

Wyszukiwarka i drukowanie wszystkich kodów korzystają z tego publicznego CSV.
Opublikowanie arkusza pozwala każdemu odczytać jego dane, więc nie umieszczaj
w nim informacji prywatnych.

#### Skonfiguruj zapis przez Apps Script

Projekt zawiera endpoint w `apps-script/Code.gs`, a `config.js` ma już
skonfigurowany adres aplikacji. Jeśli używasz tego samego arkusza i wdrożenia,
nie musisz powtarzać poniższych kroków. Dla nowego arkusza lub wdrożenia:

1. Otwórz edytowalny arkusz Google z bazą książek i wybierz zakładkę, do której
   mają trafiać zmiany.
2. Wybierz **Rozszerzenia → Apps Script**, wklej zawartość
   `apps-script/Code.gs` i zapisz projekt.
3. W edytorze wybierz funkcję `setupBookApi` i uruchom ją raz. Zapamięta
   wybrany arkusz i zakładkę oraz poprosi o wymagane uprawnienia.
4. Wybierz **Wdróż → Nowe wdrożenie → Aplikacja internetowa**. Ustaw
   wykonywanie jako siebie oraz dostęp dla każdego, kto ma link, a następnie
   wdróż aplikację.
5. Skopiuj URL wdrożenia kończący się na `/exec`. Jeśli różni się od
   aktualnego, wpisz go jako wartość `window.BOOKS_API_URL` w `config.js`
   i prześlij zmieniony plik do repozytorium.

Formularz dodawania i edycji zapisuje wartość pola **Segregator / warstwa**
w kolumnie `Binder/Layer`. Po dodaniu lub zmianie tej kolumny w arkuszu
zaktualizuj i wdróż Apps Script: **Wdróż → Zarządzaj wdrożeniami → Edytuj →
Nowa wersja → Wdróż**.

Publiczny URL Apps Script nie jest zabezpieczeniem dostępu. Przy ustawieniu
dostępu dla każdego każdy odwiedzający może dodawać, edytować i usuwać wpisy;
nie używaj endpointu z wrażliwymi danymi.

### 4. Sprawdź wdrożoną stronę

Przetestuj wyszukiwanie, otwieranie szczegółów, dodawanie, edycję, usuwanie
oraz drukowanie kodu. Sprawdź również funkcję **Funkcje zaawansowane →
Wydrukuj kody wszystkich książek z bazy danych** oraz pobieranie księgozbioru
jako pliku CSV. Plik zawiera wszystkie kolumny książek, w tym status i
wypożyczającego. Pozycja **Pokaż pożyczone książki** wyświetla aktualną listę
pożyczonych tytułów wraz z osobami, które je wypożyczyły. Wyszukiwanie
zaawansowane pozwala łączyć dowolne słowa z
kryteriami dotyczącymi autora, ilustratora, wydawnictwa, kolorów i położenia
książki; dopasowanie nie uwzględnia wielkości liter ani polskich znaków
diakrytycznych. Operacje zapisu wykonuj na testowym wpisie albo w testowym
arkuszu. Skanowanie QR wymaga HTTPS i zezwolenia przeglądarki na użycie kamery.

W widoku szczegółów przycisk **Biorę z półki** zmienia status z `Na półce` na
`Nie odłożona`. W trybie **Odkładam książkę**, po zeskanowaniu kodu albo
wybraniu wyniku, przycisk **Odkładam na półkę** zmienia status z `Nie odłożona`
lub `Pożyczona` na `Na półce`. Przy zwrocie wypożyczonej książki pole
`Borrower` jest czyszczone.

### 5. Publikuj kolejne zmiany

Po zmianie plików strony prześlij je ponownie do tej samej gałęzi. Przy użyciu
Git:

```powershell
git add .
git commit -m "Opis wprowadzonych zmian"
git push
```

GitHub Pages opublikuje nową wersję po zakończeniu zadania w **Actions**.
Odśwież stronę z pominięciem pamięci podręcznej, jeśli przeglądarka nadal
pokazuje poprzednią wersję. Przy zmianie `app.js` lub `config.js` zwiększ też
parametr `v` w ich znacznikach `<script>` w `index.html`; zapobiega to użyciu
starej kopii skryptu z pamięci podręcznej GitHub Pages lub przeglądarki.

Zmiany w `apps-script/Code.gs` wymagają osobnej publikacji w Google Apps Script:
**Wdróż → Zarządzaj wdrożeniami → Edytuj → Nowa wersja → Wdróż**. Samo
przesłanie pliku do GitHuba nie aktualizuje endpointu Apps Script. Zazwyczaj
URL `/exec` pozostaje bez zmian.

Przed zapisem strona sprawdza wersję endpointu. Jeśli Apps Script nie został
zaktualizowany, formularz pokaże komunikat o nieaktualnym wdrożeniu i nie wyśle
operacji dodania, edycji, usunięcia ani zmiany statusu.

Wyniki wyszukiwania są filtrowane po tytule i autorze bez rozróżniania wielkości
liter i polskich znaków.

Publiczny endpoint pozwala każdemu dopisywać wiersze do arkusza. Nagłówki
arkusza muszą zawierać `Title`, `Author`, `Color1`, `Color2`, `Column`, `Row`,
`Location`, `Publication date`, `Publishing house`, `Illustrator`, `status`
i `Borrower`. Wartości daty publikacji, wydawnictwa, ilustratora i wypożyczającego
są opcjonalne. Status książki musi być jedną z wartości `Na półce`,
`Nie odłożona` lub `Pożyczona`; nowe książki otrzymują domyślnie `Na półce`.
Przycisk **Pożycz książkę** zapisuje podane imię i nazwisko w `Borrower` i ustawia
status `Pożyczona`. Wyszukiwanie pokazuje wtedy `Pożyczona przez: [osoba]`.
Przy pobraniu z półki użyj **Biorę z półki**, a po odłożeniu **Odkładam na półkę**.
Skrypt sprawdza nagłówki i zabezpiecza wartości przed interpretacją jako formuły.
Endpoint obsługuje także edycję, usuwanie i zmianę statusu. Dopasowuje wiersz
po polach obecnych w arkuszu; jeśli znajdzie więcej niż jeden identyczny wpis,
odmawia zmiany zamiast modyfikować niejednoznaczny rekord.
Pożyczenie jest dostępne dla książek ze statusem `Na półce`; po podaniu osoby
endpoint zapisuje ją w `Borrower` i ustawia status `Pożyczona`.
Ponieważ wdrożenie jest dostępne dla każdego, każdy odwiedzający stronę może
dodawać, edytować i usuwać wpisy. Potwierdzenie usunięcia chroni przed
przypadkowym kliknięciem, ale nie zastępuje autoryzacji; przed udostępnieniem
strony szerszemu gronu należy ograniczyć dostęp do endpointu.

Po potwierdzonym dodaniu książki strona tworzy lokalnie kod QR zawierający
`Tytuł Autor` oraz etykietę z samym tytułem. Przycisk **Drukuj kod QR**
otwiera wydruk samej etykiety; kod można też wydrukować z widoku szczegółów
książki. Z tego widoku można również edytować dane lub usunąć książkę.
W menu **Funkcje zaawansowane** można wydrukować kody wszystkich książek.
Lista jest odświeżana z opublikowanego arkusza, a etykiety są układane po
15 na stronie A4 (3 kolumny i 5 rzędów); każda zawiera kod QR oraz pełny tytuł.
Generator QR `qrcode-generator` 2.0.4 jest dołączony lokalnie, więc tytuł
i autor nie są wysyłani do zewnętrznej usługi generującej kody. Biblioteka
jest udostępniana na licencji MIT.

W trybie **Odkładam książkę** kamera uruchamia się automatycznie po kliknięciu
przycisku. Pole tytułu pozostaje dostępne do wyszukiwania ręcznego; wpisanie
tekstu zatrzymuje kamerę i pokazuje wyniki. Obraz z kamery nie jest wyświetlany.
Po odczytaniu kodu QR strona otwiera bezpośrednio szczegóły dopasowanej książki,
bez listy wyników.
Skanowanie odbywa się lokalnie w przeglądarce i wymaga bezpiecznego połączenia
HTTPS (lokalnie działa również na `localhost`) oraz zgody na użycie kamery.
Dekoder `jsQR` 1.4.0 jest dołączony lokalnie na licencji Apache-2.0.