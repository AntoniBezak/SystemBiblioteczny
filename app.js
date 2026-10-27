const actions = document.querySelector(".actions");
const page = document.querySelector(".page");
const homeButton = document.querySelector(".home-button");
const borrowedBooksView = document.querySelector(".borrowed-books-view");
const borrowedBooksStatus = document.querySelector(".borrowed-books-view__status");
const borrowedBooksList = document.querySelector(".borrowed-books-list");
const searchView = document.querySelector(".search-view");
const addView = document.querySelector(".add-view");
const searchInput = document.querySelector("#book-search");
const searchForm = document.querySelector(".search-form");
const advancedSearchForm = document.querySelector(".advanced-search-form");
const qrScanner = document.querySelector(".qr-scanner");
const qrScannerVideo = document.querySelector(".qr-scanner__video");
const qrScannerStatus = document.querySelector(".qr-scanner__status");
const searchAction = document.querySelector('[data-action="search"]');
const returnAction = document.querySelector('[data-action="return"]');
const addAction = document.querySelector('[data-action="add"]');
const advancedSearchAction = document.querySelector('[data-action="advanced-search"]');
const showBorrowedBooksAction = document.querySelector('[data-action="show-borrowed-books"]');
const searchStatus = document.querySelector(".search-status");
const addBookButton = document.querySelector(".add-book-button");
const addBookForm = document.querySelector(".add-book-form");
const addBookSubmit = document.querySelector(".add-book-submit");
const addBookStatus = document.querySelector(".add-book-status");
const qrLabel = document.querySelector(".qr-label");
const qrImage = document.querySelector(".qr-label__image");
const qrCaption = document.querySelector(".qr-label__caption");
const printQrButton = document.querySelector(".print-qr-button");
const submissionFrame = document.querySelector(".submission-frame");
const bookResults = document.querySelector(".book-results");
const bookDetails = document.querySelector(".book-details");
const bookActionStatus = document.querySelector(".book-action-status");
const bookDetailsQrLabel = document.querySelector(".book-details__qr-label");
const bookDetailsQrImage = document.querySelector(".book-details__qr-image");
const bookDetailsQrCaption = document.querySelector(".book-details__qr-caption");
const bookDetailsActions = document.querySelector(".book-details__actions");
const printAllQrButton = document.querySelector('[data-action="print-all-qr"]');
const downloadBooksButton = document.querySelector('[data-action="download-books"]');
const advancedFunctionsMenu = document.querySelector(".advanced-functions");
const advancedFunctionsStatus = document.querySelector(".advanced-functions__status");
const bulkQrPrint = document.querySelector(".bulk-qr-print");
const booksApiVersion = "2026-10-27-binder-layer-1";
const booksUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT62yhghPmouKRZLZ2EuJL6gWEyj_dH-VLSv7_gboYX84xUVuDMIBCzMkEF3xPxzzdaGMtb2CpkA3lu/pub?output=csv";
const booksApiUrl = window.BOOKS_API_URL ?? "";
let books = [];
let booksLoaded = false;
let booksLoadPromise;
let lookupMode = "search";
let addRequestTimer;
let addRequestPending = false;
let pendingRequestId;
let pendingRequestPhase;
let pendingBook;
let pendingQrDataUrl;
let pendingTargetBook;
let pendingOperation;
let selectedBook;
let cameraStream;
let scannerFrameId;
let scannerActive = false;
let scannerRequestId = 0;
let returnScanMode = false;
let pendingScannedCode;
let scannedCodeUnmatched = false;
const scannerCanvas = document.createElement("canvas");
const scannerContext = scannerCanvas.getContext("2d", { willReadFrequently: true });

function createRequestId() {
  const randomValues = new Uint32Array(4);
  window.crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => value.toString(16).padStart(8, "0")).join("");
}

function setAddStatus(message, isError = false) {
  addBookStatus.textContent = message;
  addBookStatus.classList.toggle("add-book-status--error", isError);
  addBookStatus.hidden = message === "";
}

function createQrDataUrl(value) {
  const code = qrcode(0, "M");
  code.addData(value, "Byte");
  code.make();
  return code.createDataURL(6, 4);
}

function showQrLabel(book, dataUrl) {
  qrImage.src = dataUrl;
  qrImage.alt = `Kod QR dla książki ${book.title} — ${book.author}`;
  qrCaption.textContent = book.title;
  qrLabel.hidden = false;
  printQrButton.hidden = false;
}

function showBookDetailsQr(book) {
  const dataUrl = createQrDataUrl(`${book.title} ${book.author}`);
  bookDetailsQrImage.src = dataUrl;
  bookDetailsQrImage.alt = `Kod QR dla książki ${book.title} — ${book.author}`;
  bookDetailsQrCaption.textContent = book.title;
  bookDetailsQrLabel.hidden = false;
  page.classList.add("page--details-qr-ready");
  window.print();
}

function setBookActionStatus(message, isError = false) {
  bookActionStatus.textContent = message;
  bookActionStatus.classList.toggle("book-action-status--error", isError);
  bookActionStatus.hidden = message === "";
}

function setAdvancedFunctionsStatus(message, isError = false) {
  advancedFunctionsStatus.textContent = message;
  advancedFunctionsStatus.classList.toggle("advanced-functions__status--error", isError);
  advancedFunctionsStatus.hidden = message === "";
}

function getApiVersionError(receivedVersion) {
  return `Wersja Apps Script (${receivedVersion || "brak odpowiedzi"}) nie zgadza się z wersją strony (${booksApiVersion}). Odśwież stronę z pominięciem pamięci podręcznej i spróbuj ponownie.`;
}

function createBooksCsv(loadedBooks) {
  const headers = [
    "Title",
    "Author",
    "Color1",
    "Color2",
    "Column",
    "Row",
    "Location",
    "Publication date",
    "Publishing house",
    "Illustrator",
    "Binder/Layer",
    "status",
    "Borrower",
  ];
  const values = loadedBooks.map((book) => [
    book.title,
    book.author,
    book.color,
    book.color2,
    book.column,
    book.row,
    book.location,
    book.publicationDate,
    book.publishingHouse,
    book.illustrator,
    book.binderLayer,
    book.status,
    book.borrower,
  ]);
  const escapeCsvValue = (value) => {
    const text = value ?? "";
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [headers, ...values].map((row) => row.map(escapeCsvValue).join(","));

  return `\uFEFF${rows.join("\r\n")}`;
}

async function downloadBooksCsv() {
  if (downloadBooksButton.disabled) {
    return;
  }

  downloadBooksButton.disabled = true;
  setAdvancedFunctionsStatus("Wczytywanie księgozbioru…");

  try {
    const loadedBooks = await loadBooks(true);
    if (!loadedBooks) {
      throw new Error("Nie udało się wczytać listy książek. Sprawdź połączenie i dostęp do arkusza.");
    }

    const file = new Blob([createBooksCsv(loadedBooks)], { type: "text/csv;charset=utf-8" });
    const fileUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = `ksiegozbior-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    setAdvancedFunctionsStatus(`Pobrano księgozbiór (${loadedBooks.length} książek).`);
  } catch (error) {
    console.error("Nie udało się pobrać księgozbioru:", error);
    setAdvancedFunctionsStatus(error.message || "Nie udało się pobrać księgozbioru.", true);
  } finally {
    downloadBooksButton.disabled = false;
  }
}

async function printAllBookQrs() {
  if (printAllQrButton.disabled) {
    return;
  }

  printAllQrButton.disabled = true;
  setAdvancedFunctionsStatus("Wczytywanie księgozbioru…");

  try {
    const loadedBooks = await loadBooks(true);
    if (!loadedBooks) {
      throw new Error("Nie udało się wczytać listy książek. Sprawdź połączenie i dostęp do arkusza.");
    }
    if (loadedBooks.length === 0) {
      throw new Error("W bazie danych nie ma książek do wydrukowania.");
    }

    const fragment = document.createDocumentFragment();
    const booksPerPage = 15;
    const imagePromises = [];

    for (let start = 0; start < loadedBooks.length; start += booksPerPage) {
      const printPage = document.createElement("section");
      printPage.className = "bulk-qr-page";
      printPage.setAttribute("aria-label", `Strona ${Math.floor(start / booksPerPage) + 1}`);

      loadedBooks.slice(start, start + booksPerPage).forEach((book) => {
        const label = document.createElement("figure");
        const image = document.createElement("img");
        const caption = document.createElement("figcaption");

        label.className = "bulk-qr-label";
        image.alt = `Kod QR dla książki ${book.title} — ${book.author}`;
        image.src = createQrDataUrl(`${book.title} ${book.author}`);
        caption.textContent = book.title;
        label.append(image, caption);
        printPage.append(label);
        imagePromises.push(image.decode());
      });

      fragment.append(printPage);
    }

    bulkQrPrint.replaceChildren(fragment);
    await Promise.all(imagePromises);
    setAdvancedFunctionsStatus("");
    page.classList.add("page--bulk-qr-ready");
    window.print();
  } catch (error) {
    console.error("Nie udało się przygotować wydruku kodów QR:", error);
    bulkQrPrint.replaceChildren();
    page.classList.remove("page--bulk-qr-ready");
    setAdvancedFunctionsStatus(error.message || "Nie udało się przygotować wydruku kodów QR.", true);
  } finally {
    printAllQrButton.disabled = false;
  }
}

function getBookFormValues(book) {
  return {
    title: book.title,
    author: book.author,
    color1: book.color,
    color2: book.color2,
    location: book.location,
    column: book.column,
    row: book.row,
    publicationDate: book.publicationDate,
    publishingHouse: book.publishingHouse,
    illustrator: book.illustrator,
    binderLayer: book.binderLayer,
    status: book.status,
    borrower: book.borrower,
  };
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (insideQuotes) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      insideQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
      if (character === "\r" && csv[index + 1] === "\n") {
        index += 1;
      }
    } else {
      field += character;
    }
  }

  if (insideQuotes) {
    throw new Error("Plik CSV zawiera niedomknięty cudzysłów.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
  }

  if (rows.length < 2) {
    throw new Error("Plik CSV nie zawiera książek.");
  }

  const headers = rows[0].map((header) => header.trim().toLocaleLowerCase("pl"));
  const titleIndex = headers.indexOf("title");
  const authorIndex = headers.indexOf("author");
  const colorIndex = headers.indexOf("color1");
  const columnIndex = headers.indexOf("column");
  const rowIndex = headers.indexOf("row");
  const locationIndex = headers.indexOf("location");
  const publicationDateIndex = headers.indexOf("publication date");
  const publishingHouseIndex = headers.indexOf("publishing house");
  const illustratorIndex = headers.indexOf("illustrator");
  const binderLayerIndex = headers.indexOf("binder/layer");
  const statusIndex = headers.indexOf("status");

  const requiredHeaders = ["title", "author", "color1", "color2", "column", "row", "location", "status", "borrower"];
  if (requiredHeaders.some((header) => !headers.includes(header))) {
    throw new Error("Plik CSV musi zawierać kolumny Title, Author, Color1, Color2, Column, Row, Location, status i Borrower.");
  }

  return rows.slice(1)
    .map((values) => ({
      title: (values[titleIndex] ?? "").trim(),
      author: (values[authorIndex] ?? "").trim(),
      color: (values[colorIndex] ?? "").trim(),
      color2: (values[headers.indexOf("color2")] ?? "").trim(),
      column: (values[columnIndex] ?? "").trim(),
      row: (values[rowIndex] ?? "").trim(),
      location: (values[locationIndex] ?? "").trim(),
      publicationDate: (values[publicationDateIndex] ?? "").trim(),
      publishingHouse: (values[publishingHouseIndex] ?? "").trim(),
      illustrator: (values[illustratorIndex] ?? "").trim(),
      binderLayer: (values[binderLayerIndex] ?? "").trim(),
      status: (values[statusIndex] ?? "").trim(),
      borrower: (values[headers.indexOf("borrower")] ?? "").trim(),
    }))
    .filter((book) => book.title !== "" || book.author !== "");
}

function normalizeText(value) {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .trim();
}

function normalizeSearchValue(value) {
  return normalizeText(value)
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function showStatus(message) {
  searchStatus.textContent = message;
  searchStatus.hidden = message === "";
}

function renderCurrentResults() {
  if (lookupMode === "advanced") {
    renderAdvancedResults();
  } else if (lookupMode !== "borrowed") {
    renderResults();
  }
}

function renderBorrowedBooks(loadedBooks) {
  const borrowedBooks = loadedBooks.filter((book) => book.status === "Pożyczona");
  const fragment = document.createDocumentFragment();

  borrowedBooks.forEach((book) => {
    const item = document.createElement("li");
    const details = document.createElement("div");
    const title = document.createElement("h2");
    const author = document.createElement("p");
    const borrower = document.createElement("p");

    item.className = "borrowed-books-list__item";
    details.className = "borrowed-books-list__details";
    title.className = "borrowed-books-list__title";
    title.textContent = book.title;
    author.className = "borrowed-books-list__author";
    author.textContent = book.author;
    borrower.className = "borrowed-books-list__borrower";
    borrower.textContent = book.borrower.trim()
      ? `Wypożyczona przez: ${book.borrower}`
      : "Nie podano osoby wypożyczającej.";
    details.append(title, author);
    item.append(details, borrower);
    fragment.append(item);
  });

  borrowedBooksList.replaceChildren(fragment);
  borrowedBooksStatus.classList.remove("borrowed-books-view__status--error");
  borrowedBooksStatus.textContent = borrowedBooks.length === 0
    ? "Brak pożyczonych książek."
    : `Liczba pożyczonych książek: ${borrowedBooks.length}.`;
  borrowedBooksList.hidden = borrowedBooks.length === 0;
}

async function showBorrowedBooks() {
  stopQrScanner();
  advancedFunctionsMenu.open = false;
  lookupMode = "borrowed";
  returnScanMode = false;
  pendingScannedCode = undefined;
  borrowedBooksView.hidden = false;
  searchView.hidden = true;
  addView.hidden = true;
  actions.hidden = true;
  page.classList.remove("page--book-selected", "page--return-scanning", "page--advanced-search");
  borrowedBooksList.replaceChildren();
  borrowedBooksList.hidden = true;
  borrowedBooksStatus.classList.remove("borrowed-books-view__status--error");
  borrowedBooksStatus.textContent = "Wczytywanie księgozbioru…";

  const loadedBooks = await loadBooks(true);
  if (!loadedBooks) {
    borrowedBooksStatus.classList.add("borrowed-books-view__status--error");
    borrowedBooksStatus.textContent = "Nie udało się wczytać księgozbioru. Sprawdź połączenie i spróbuj ponownie.";
    return;
  }

  renderBorrowedBooks(loadedBooks);
}

function stopQrScanner(message = "") {
  scannerRequestId += 1;
  scannerActive = false;
  window.cancelAnimationFrame(scannerFrameId);
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  qrScannerVideo.srcObject = null;
  qrScanner.hidden = message === "";
  qrScannerStatus.textContent = message;
}

function handleScannedCode(value) {
  const decodedText = value.trim();
  if (!decodedText) {
    return;
  }

  stopQrScanner();
  if (!booksLoaded) {
    pendingScannedCode = decodedText;
    qrScanner.hidden = false;
    qrScannerStatus.textContent = "Kod odczytany. Wczytywanie danych książki…";
    return;
  }

  searchInput.value = decodedText;
  const scannedBook = books.find((book) =>
    normalizeText(`${book.title} ${book.author}`) === normalizeText(decodedText)
  );

  if (scannedBook) {
    scannedCodeUnmatched = false;
    returnScanMode = false;
    page.classList.remove("page--return-scanning");
    showStatus("");
    showBookDetails(scannedBook);
    return;
  }

  scannedCodeUnmatched = true;
  showStatus("Nie znaleziono książki z tego kodu QR w bazie.");
  addBookButton.hidden = false;
}

function scanVideoFrame() {
  if (!scannerActive) {
    return;
  }

  if (qrScannerVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && qrScannerVideo.videoWidth > 0
    && qrScannerVideo.videoHeight > 0) {
    const scale = Math.min(1, 800 / qrScannerVideo.videoWidth);
    scannerCanvas.width = Math.round(qrScannerVideo.videoWidth * scale);
    scannerCanvas.height = Math.round(qrScannerVideo.videoHeight * scale);
    scannerContext.drawImage(qrScannerVideo, 0, 0, scannerCanvas.width, scannerCanvas.height);
    const image = scannerContext.getImageData(0, 0, scannerCanvas.width, scannerCanvas.height);
    const result = jsQR(image.data, image.width, image.height, {
      inversionAttempts: "dontInvert",
    });

    if (result?.data.trim()) {
      handleScannedCode(result.data);
      return;
    }
  }

  scannerFrameId = window.requestAnimationFrame(scanVideoFrame);
}

async function startQrScanner() {
  const requestId = ++scannerRequestId;
  qrScanner.hidden = false;
  qrScannerStatus.textContent = "Skieruj kod QR na etykiecie przed kamerę…";

  if (!navigator.mediaDevices?.getUserMedia) {
    stopQrScanner("Ta przeglądarka nie udostępnia kamery. Otwórz stronę przez HTTPS i spróbuj ponownie.");
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    if (requestId !== scannerRequestId) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = undefined;
      return;
    }
    qrScannerVideo.srcObject = cameraStream;
    await qrScannerVideo.play();
    scannerActive = true;
    qrScannerStatus.textContent = "Skieruj kamerę na kod QR książki.";
    scanVideoFrame();
  } catch (error) {
    if (requestId !== scannerRequestId) {
      return;
    }
    console.error("Nie udało się uruchomić skanera QR:", error);
    let message = "Nie udało się uruchomić kamery. Sprawdź jej ustawienia i spróbuj ponownie.";
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      message = "Brak dostępu do kamery. Zezwól stronie na używanie kamery i spróbuj ponownie.";
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      message = "Nie znaleziono kamery w tym urządzeniu.";
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      message = "Nie można użyć kamery. Może być zajęta przez inną aplikację.";
    }
    stopQrScanner(message);
  }
}

function showBookDetails(book) {
  selectedBook = book;
  bookDetails.replaceChildren();
  bookDetailsQrLabel.hidden = true;
  page.classList.remove("page--details-qr-ready");
  setBookActionStatus("");

  if (lookupMode !== "return") {
    const heading = document.createElement("h2");
    heading.className = "book-details__title";
    heading.tabIndex = -1;
    heading.textContent = book.title;
    bookDetails.append(heading);

    if (book.author !== "") {
      const author = document.createElement("p");
      author.className = "book-details__author";
      author.textContent = book.author;
      bookDetails.append(author);
    }

    const bookStatus = book.status || "Na półce";
    if (bookStatus === "Na półce" || bookStatus === "Nie odłożona" || bookStatus === "Pożyczona") {
      const status = document.createElement("p");
      const statusClass = bookStatus === "Na półce"
        ? "available"
        : bookStatus === "Nie odłożona"
          ? "not-shelved"
          : "loaned";
      status.className = `book-details__availability book-details__availability--${statusClass}`;
      status.textContent = bookStatus === "Pożyczona" && book.borrower
        ? `Pożyczona przez: ${book.borrower}`
        : bookStatus;
      bookDetails.append(status);
    }
  }

  const fields = [
    ["Szafka", book.location],
    ["Kolumna", book.column],
    ["Półka", book.row],
  ];
  if (lookupMode !== "return") {
    fields.push(
      ["Data publikacji", book.publicationDate],
      ["Wydawnictwo", book.publishingHouse],
      ["Ilustrator", book.illustrator],
      ["Segregator / warstwa", book.binderLayer],
    );
    fields.push(["Kolor grzbietu", book.color]);
  }
  const list = document.createElement("dl");
  list.className = "book-details__fields";
  list.tabIndex = -1;

  fields.forEach(([label, value]) => {
    if (value === "") {
      return;
    }

    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    list.append(term, description);
  });

  if (list.childElementCount > 0) {
    bookDetails.append(list);
  }

  bookDetails.append(bookDetailsActions, bookActionStatus, bookDetailsQrLabel);
  const bookStatus = book.status || "Na półce";
  bookDetailsActions.querySelector('[data-book-action="pickup"]').hidden =
    !["search", "advanced"].includes(lookupMode) || bookStatus !== "Na półce";
  bookDetailsActions.querySelector('[data-book-action="shelve"]').hidden =
    lookupMode !== "return" || !["Nie odłożona", "Pożyczona"].includes(bookStatus);
  bookDetailsActions.querySelector('[data-book-action="lend"]').hidden =
    !["search", "advanced"].includes(lookupMode) || bookStatus !== "Na półce";
  bookDetailsQrCaption.textContent = book.title;
  bookDetails.hidden = false;
  page.classList.add("page--book-selected");
  if (lookupMode !== "return") {
    bookDetails.querySelector(".book-details__title").focus();
  } else {
    list.focus();
  }
}

function renderResults() {
  const query = normalizeText(searchInput.value);
  bookResults.replaceChildren();
  bookDetails.hidden = true;
  bookDetails.replaceChildren();
  selectedBook = undefined;
  addBookButton.hidden = true;
  page.classList.remove("page--book-selected");
  page.classList.remove("page--return-scanning");
  returnScanMode = false;
  stopQrScanner();

  if (query === "") {
    showStatus(booksLoaded ? "" : searchStatus.textContent);
    return;
  }

  if (!booksLoaded) {
    return;
  }

  const matches = books.filter((book) => {
    const searchableText = lookupMode === "return"
      ? `${book.title} ${book.author}`
      : `${book.title} ${book.author}`;
    return normalizeText(searchableText).includes(query)
      || (lookupMode === "return" && normalizeText(book.title).includes(query));
  });

  if (matches.length === 0) {
    showStatus(lookupMode === "return"
      ? "Nie znaleziono książki w bazie."
      : "Nie znaleziono książek.");
    addBookButton.hidden = lookupMode !== "return";
    return;
  }

  showStatus("");
  const fragment = document.createDocumentFragment();

  matches.forEach((book) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const title = document.createElement("span");
    const author = document.createElement("span");

    item.className = "book-result";
    button.className = "book-result__button";
    button.type = "button";
    title.className = "book-result__title";
    author.className = "book-result__author";
    title.textContent = book.title;
    author.textContent = book.author;
    button.append(title, author);
    button.addEventListener("click", () => showBookDetails(book));
    item.append(button);
    fragment.append(item);
  });

  bookResults.append(fragment);
}

function renderAdvancedResults() {
  const formData = new FormData(advancedSearchForm);
  const query = normalizeSearchValue(String(formData.get("query") ?? ""));
  const queryTerms = query === "" ? [] : query.split(" ");
  const searchableFields = [
    ["author", "author"],
    ["illustrator", "illustrator"],
    ["publishingHouse", "publishingHouse"],
    ["publicationDate", "publicationDate"],
    ["binderLayer", "binderLayer"],
    ["color2", "color2"],
    ["color", "color"],
    ["location", "location"],
    ["column", "column"],
    ["row", "row"],
  ];
  const criteria = searchableFields
    .map(([inputName, bookField]) => [
      bookField,
      normalizeSearchValue(String(formData.get(inputName) ?? "")).split(" "),
    ])
    .filter(([, terms]) => terms[0] !== "");

  bookResults.replaceChildren();
  bookDetails.hidden = true;
  bookDetails.replaceChildren();
  selectedBook = undefined;
  page.classList.remove("page--book-selected");

  if (!booksLoaded) {
    return;
  }

  if (queryTerms.length === 0 && criteria.length === 0) {
    showStatus("Wpisz przynajmniej jedną informację o książce.");
    return;
  }

  const matches = books.filter((book) => {
    return matchesAdvancedSearch(book, queryTerms, criteria);
  });

  if (matches.length === 0) {
    showStatus("Nie znaleziono książek. Spróbuj wpisać mniej szczegółów.");
    return;
  }

  showStatus(`Znaleziono książek: ${matches.length}.`);
  const fragment = document.createDocumentFragment();

  matches.forEach((book) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const title = document.createElement("span");
    const author = document.createElement("span");

    item.className = "book-result";
    button.className = "book-result__button";
    button.type = "button";
    title.className = "book-result__title";
    author.className = "book-result__author";
    title.textContent = book.title;
    author.textContent = book.author;
    button.append(title, author);
    button.addEventListener("click", () => showBookDetails(book));
    item.append(button);
    fragment.append(item);
  });

  bookResults.append(fragment);
}

function matchesAdvancedSearch(book, queryTerms, criteria) {
  const searchableText = normalizeSearchValue([
    book.title,
    book.author,
    book.color,
    book.color2,
    book.column,
    book.row,
    book.location,
    book.publicationDate,
    book.publishingHouse,
    book.illustrator,
    book.binderLayer,
    book.status,
    book.borrower,
  ].join(" "));

  return queryTerms.every((term) => searchableText.includes(term))
    && criteria.every(([bookField, terms]) =>
      terms.every((term) => normalizeSearchValue(book[bookField]).includes(term))
    );
}

function loadBooks(forceRefresh = false) {
  if (booksLoaded && !forceRefresh) {
    if (pendingScannedCode) {
      const scannedCode = pendingScannedCode;
      pendingScannedCode = undefined;
      handleScannedCode(scannedCode);
    } else if (!returnScanMode) {
      renderCurrentResults();
    }
    return Promise.resolve(books);
  }

  if (booksLoadPromise) {
    return booksLoadPromise;
  }

  showStatus("Wczytywanie księgozbioru…");
  booksLoaded = false;
  booksLoadPromise = (async () => {
    try {
      const response = await fetch(booksUrl);
      if (!response.ok) {
        throw new Error(`Serwer zwrócił błąd ${response.status}.`);
      }

      books = parseCsv(await response.text());
      booksLoaded = true;
      showStatus("");
      if (pendingScannedCode) {
        const scannedCode = pendingScannedCode;
        pendingScannedCode = undefined;
        handleScannedCode(scannedCode);
      } else if (!returnScanMode) {
        renderCurrentResults();
      }
      return books;
    } catch (error) {
      console.error("Nie udało się wczytać pliku z książkami:", error);
      showStatus("Nie udało się wczytać listy książek. Sprawdź połączenie i dostęp do pliku Google Drive.");
      return undefined;
    } finally {
      booksLoadPromise = undefined;
    }
  })();
  return booksLoadPromise;
}

function startAddBook(title = "") {
  borrowedBooksView.hidden = true;
  page.classList.remove("page--book-selected");
  page.classList.remove("page--qr-ready");
  page.classList.remove("page--return-scanning");
  returnScanMode = false;
  actions.hidden = true;
  searchView.hidden = true;
  addView.hidden = false;
  addBookForm.reset();
  addBookForm.dataset.operation = "create";
  addBookForm.elements.action.value = "create";
  addBookForm.elements.status.value = "Na półce";
  addBookForm.querySelector(".add-book-submit").textContent = "Dodaj książkę";
  addBookForm.hidden = false;
  qrLabel.hidden = true;
  printQrButton.hidden = true;
  addBookForm.elements.title.value = title;
  setAddStatus(booksApiUrl ? "" : "Dodawanie wymaga skonfigurowania adresu Google Apps Script.");
  addBookSubmit.disabled = addRequestPending;
  addBookSubmit.focus();
  if (title === "") {
    addBookForm.elements.title.focus();
  } else {
    addBookForm.elements.author.focus();
  }
}

function startEditBook(book) {
  borrowedBooksView.hidden = true;
  stopQrScanner();
  page.classList.remove("page--book-selected");
  page.classList.remove("page--details-qr-ready");
  page.classList.remove("page--qr-ready");
  actions.hidden = true;
  searchView.hidden = true;
  addView.hidden = false;
  addBookForm.hidden = false;
  addBookForm.reset();
  addBookForm.dataset.operation = "update";
  addBookForm.elements.action.value = "update";
  addBookForm.querySelector(".add-book-submit").textContent = "Zapisz zmiany";
  addBookForm.elements.title.value = book.title;
  addBookForm.elements.author.value = book.author;
  addBookForm.elements.color1.value = book.color;
  addBookForm.elements.color2.value = book.color2;
  addBookForm.elements.location.value = book.location;
  addBookForm.elements.column.value = book.column;
  addBookForm.elements.row.value = book.row;
  addBookForm.elements.publicationDate.value = book.publicationDate;
  addBookForm.elements.publishingHouse.value = book.publishingHouse;
  addBookForm.elements.illustrator.value = book.illustrator;
  addBookForm.elements.binderLayer.value = book.binderLayer || "";
  addBookForm.elements.status.value = book.status || "Na półce";
  addBookForm.elements.borrower.value = book.borrower || "";
  pendingTargetBook = book;
  setAddStatus("");
  addBookForm.elements.title.focus();
}

function sendBookRequest(operation, book, targetBook = book) {
  if (!booksApiUrl) {
    setBookActionStatus("Dodawanie wymaga skonfigurowanego adresu Google Apps Script.", true);
    return;
  }

  pendingOperation = operation;
  pendingBook = book;
  pendingTargetBook = targetBook;
  pendingRequestId = createRequestId();
  pendingRequestPhase = "version-check";
  addBookForm.elements.requestId.value = pendingRequestId;
  addBookForm.elements.action.value = "version";

  const targetValues = getBookFormValues(targetBook);
  Object.entries(targetValues).forEach(([name, value]) => {
    addBookForm.elements[`target${name[0].toUpperCase()}${name.slice(1)}`].value = value;
  });
  const values = getBookFormValues(book);
  Object.entries(values).forEach(([name, value]) => {
    addBookForm.elements[name].value = value;
  });

  addBookForm.action = booksApiUrl;
  addBookForm.method = "post";
  addBookForm.target = submissionFrame.name;
  addRequestPending = true;
  addBookSubmit.disabled = true;
  if (operation === "create" || operation === "update") {
    addView.hidden = false;
    searchView.hidden = true;
    addBookForm.hidden = false;
    setAddStatus(operation === "create" ? "Dodawanie książki…" : "Zapisywanie zmian…");
  } else {
    bookDetailsActions.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
    setBookActionStatus(operation === "delete"
      ? "Usuwanie książki…"
      : operation === "lend"
        ? "Rejestrowanie wypożyczenia…"
      : operation === "set-status"
        ? "Aktualizowanie statusu książki…"
        : "Przetwarzanie…");
  }
  submitBookApiForm();
  startBookRequestTimeout();
}

function submitBookApiForm() {
  HTMLFormElement.prototype.submit.call(addBookForm);
}

function startBookRequestTimeout() {
  window.clearTimeout(addRequestTimer);
  addRequestTimer = window.setTimeout(() => {
    addRequestPending = false;
    pendingRequestPhase = undefined;
    addBookSubmit.disabled = false;
    if (pendingOperation === "delete" || pendingOperation === "set-status" || pendingOperation === "lend") {
      bookDetailsActions.querySelectorAll("button").forEach((button) => {
        button.disabled = false;
      });
      setBookActionStatus("Nie otrzymano potwierdzenia. Sprawdź arkusz przed ponowną próbą.", true);
    } else {
      setAddStatus("Nie otrzymano potwierdzenia. Sprawdź arkusz przed ponowną próbą.", true);
    }
  }, 30000);
}

function startLookup(mode) {
  stopQrScanner();
  borrowedBooksView.hidden = true;
  lookupMode = mode;
  returnScanMode = mode === "return";
  pendingScannedCode = undefined;
  scannedCodeUnmatched = false;
  addView.hidden = true;
  advancedSearchForm.hidden = true;
  searchForm.hidden = false;
  page.classList.remove("page--advanced-search");
  searchInput.value = "";
  searchInput.placeholder = mode === "return" ? "Tytuł odkładanej książki" : "Tytuł, autor lub słowo kluczowe";
  searchInput.labels[0].textContent = mode === "return" ? "Wpisz tytuł odkładanej książki" : "Szukaj książki";
  addBookButton.hidden = true;
  bookResults.replaceChildren();
  bookDetails.replaceChildren();
  bookDetails.hidden = true;
  selectedBook = undefined;
  page.classList.remove("page--details-qr-ready");
  page.classList.remove("page--book-selected");
  actions.hidden = true;
  searchView.hidden = false;
  if (mode === "return") {
    page.classList.add("page--return-scanning");
    qrScanner.hidden = false;
    qrScannerStatus.textContent = "Skieruj kod QR na etykiecie przed kamerę…";
    startQrScanner();
  }
  searchInput.focus();
  loadBooks();
}

function startAdvancedSearch() {
  stopQrScanner();
  advancedFunctionsMenu.open = false;
  borrowedBooksView.hidden = true;
  lookupMode = "advanced";
  returnScanMode = false;
  pendingScannedCode = undefined;
  scannedCodeUnmatched = false;
  addView.hidden = true;
  searchInput.value = "";
  advancedSearchForm.reset();
  advancedSearchForm.hidden = false;
  searchForm.hidden = true;
  addBookButton.hidden = true;
  bookResults.replaceChildren();
  bookDetails.replaceChildren();
  bookDetails.hidden = true;
  selectedBook = undefined;
  page.classList.remove("page--book-selected");
  page.classList.remove("page--return-scanning");
  page.classList.remove("page--details-qr-ready");
  page.classList.add("page--advanced-search");
  actions.hidden = true;
  searchView.hidden = false;
  showStatus("");
  advancedSearchForm.elements.query.focus();
  loadBooks();
}

searchAction.addEventListener("click", () => startLookup("search"));
returnAction.addEventListener("click", () => startLookup("return"));
addAction.addEventListener("click", () => startAddBook());
advancedSearchAction.addEventListener("click", startAdvancedSearch);
showBorrowedBooksAction.addEventListener("click", showBorrowedBooks);
addBookButton.addEventListener("click", () =>
  startAddBook(scannedCodeUnmatched ? "" : searchInput.value.trim())
);
printAllQrButton.addEventListener("click", printAllBookQrs);
downloadBooksButton.addEventListener("click", downloadBooksCsv);
window.addEventListener("afterprint", () => {
  page.classList.remove("page--bulk-qr-ready");
  bulkQrPrint.replaceChildren();
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

searchInput.addEventListener("input", () => {
if (returnScanMode) {
  returnScanMode = false;
  pendingScannedCode = undefined;
  page.classList.remove("page--return-scanning");
  stopQrScanner();
}
renderResults();
});

advancedSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderAdvancedResults();
});

advancedSearchForm.addEventListener("input", renderAdvancedResults);

advancedSearchForm.addEventListener("reset", () => {
  window.setTimeout(() => {
    if (lookupMode === "advanced" && !searchView.hidden) {
      renderAdvancedResults();
    }
  }, 0);
});

addBookForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!booksApiUrl) {
    setAddStatus("Dodawanie wymaga skonfigurowania adresu Google Apps Script.", true);
    return;
  }

  const formData = new FormData(addBookForm);
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string" && value.trim() === "") {
      addBookForm.elements[name].value = "";
    } else if (typeof value === "string") {
      addBookForm.elements[name].value = value.trim();
    }
  }

  const normalizedFormData = new FormData(addBookForm);
  if (!addBookForm.reportValidity()) {
    return;
  }

  const book = {
    title: String(normalizedFormData.get("title")),
    author: String(normalizedFormData.get("author")),
    color: String(normalizedFormData.get("color1")),
    color2: String(normalizedFormData.get("color2")),
    location: String(normalizedFormData.get("location")),
    column: String(normalizedFormData.get("column")),
    row: String(normalizedFormData.get("row")),
    publicationDate: String(normalizedFormData.get("publicationDate")),
    publishingHouse: String(normalizedFormData.get("publishingHouse")),
    illustrator: String(normalizedFormData.get("illustrator")),
    binderLayer: String(normalizedFormData.get("binderLayer")),
    status: String(normalizedFormData.get("status")),
    borrower: String(normalizedFormData.get("borrower")),
  };

  const operation = addBookForm.dataset.operation || "create";
  if (operation === "create") {
    try {
      pendingQrDataUrl = createQrDataUrl(`${book.title} ${book.author}`);
    } catch (error) {
      console.error("Nie udało się przygotować kodu QR:", error);
      setAddStatus("Nie udało się przygotować kodu QR. Sprawdź dane książki i spróbuj ponownie.", true);
      return;
    }
  }

  sendBookRequest(operation, book, operation === "update" ? pendingTargetBook : book);
});

bookDetailsActions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-book-action]");
  if (!button || !selectedBook) {
    return;
  }

  if (button.dataset.bookAction === "edit") {
    startEditBook(selectedBook);
  } else if (button.dataset.bookAction === "delete") {
    const confirmation = `Czy na pewno usunąć książkę „${selectedBook.title}” z biblioteki?`;
    if (window.confirm(confirmation)) {
      sendBookRequest("delete", selectedBook);
    }
  } else if (button.dataset.bookAction === "pickup") {
    sendBookRequest("set-status", { ...selectedBook, status: "Nie odłożona" }, selectedBook);
  } else if (button.dataset.bookAction === "shelve") {
    sendBookRequest("set-status", { ...selectedBook, status: "Na półce", borrower: "" }, selectedBook);
  } else if (button.dataset.bookAction === "lend") {
    const borrower = window.prompt("Podaj imię i nazwisko osoby wypożyczającej książkę:");
    if (borrower === null) {
      return;
    }
    if (!borrower.trim()) {
      setBookActionStatus("Wpisz imię i nazwisko osoby wypożyczającej książkę.", true);
      return;
    }
    if (borrower.trim().length > 200) {
      setBookActionStatus("Imię i nazwisko nie może przekraczać 200 znaków.", true);
      return;
    }
    sendBookRequest("lend", {
      ...selectedBook,
      status: "Pożyczona",
      borrower: borrower.trim(),
    }, selectedBook);
  } else if (button.dataset.bookAction === "print-qr") {
    try {
      showBookDetailsQr(selectedBook);
    } catch (error) {
      console.error("Nie udało się przygotować kodu QR:", error);
      setBookActionStatus("Nie udało się przygotować kodu QR.", true);
    }
  }
});

window.addEventListener("message", (event) => {
  const isTrustedGoogleOrigin = event.origin === "https://script.google.com"
    || event.origin === "https://script.googleusercontent.com"
    || event.origin.endsWith("-script.googleusercontent.com");
  if (!isTrustedGoogleOrigin
    || event.data?.type !== "book-submit-result"
    || !pendingRequestId
    || event.data.requestId !== pendingRequestId) {
    return;
  }

  if (!addRequestPending) {
    return;
  }

  if (pendingRequestPhase === "version-check") {
    if (event.data.apiVersion !== booksApiVersion) {
      window.clearTimeout(addRequestTimer);
      addRequestPending = false;
      pendingRequestPhase = undefined;
      pendingRequestId = undefined;
      addBookSubmit.disabled = false;
      const versionError = getApiVersionError(event.data.apiVersion);
      if (pendingOperation === "delete" || pendingOperation === "set-status" || pendingOperation === "lend") {
        bookDetailsActions.querySelectorAll("button").forEach((button) => {
          button.disabled = false;
        });
        setBookActionStatus(versionError, true);
      } else {
        setAddStatus(versionError, true);
      }
      pendingOperation = undefined;
      return;
    }

    if (!event.data.ok) {
      window.clearTimeout(addRequestTimer);
      addRequestPending = false;
      pendingRequestPhase = undefined;
      pendingRequestId = undefined;
      addBookSubmit.disabled = false;
      const errorMessage = event.data.message || "Nie udało się sprawdzić wersji Apps Script.";
      if (pendingOperation === "delete" || pendingOperation === "set-status" || pendingOperation === "lend") {
        bookDetailsActions.querySelectorAll("button").forEach((button) => {
          button.disabled = false;
        });
        setBookActionStatus(errorMessage, true);
      } else {
        setAddStatus(errorMessage, true);
      }
      pendingOperation = undefined;
      return;
    }

    pendingRequestPhase = "mutation";
    addBookForm.elements.action.value = pendingOperation;
    submitBookApiForm();
    startBookRequestTimeout();
    return;
  }

  window.clearTimeout(addRequestTimer);
  addRequestPending = false;
  pendingRequestPhase = undefined;
  pendingRequestId = undefined;
  addBookSubmit.disabled = false;

  if (!event.data.ok || event.data.apiVersion !== booksApiVersion) {
    const errorMessage = event.data.apiVersion !== booksApiVersion
      ? getApiVersionError(event.data.apiVersion)
      : event.data.message || "Operacja nie powiodła się.";
    if (pendingOperation === "delete" || pendingOperation === "set-status" || pendingOperation === "lend") {
      bookDetailsActions.querySelectorAll("button").forEach((button) => {
        button.disabled = false;
      });
      setBookActionStatus(errorMessage, true);
    } else {
      setAddStatus(errorMessage, true);
    }
    pendingOperation = undefined;
    return;
  }

  if (pendingOperation === "create") {
    books.push(pendingBook);
    showQrLabel(pendingBook, pendingQrDataUrl);
    page.classList.add("page--qr-ready");
    addBookForm.hidden = true;
    setAddStatus("Książka została dodana do bazy danych.");
  } else if (pendingOperation === "update") {
    Object.assign(pendingTargetBook, pendingBook);
    addView.hidden = true;
    searchView.hidden = false;
    page.classList.remove("page--qr-ready");
    showBookDetails(pendingTargetBook);
    setBookActionStatus("Informacje o książce zostały zaktualizowane.");
  } else if (pendingOperation === "delete") {
    books = books.filter((book) => book !== pendingTargetBook);
    selectedBook = undefined;
    bookDetails.hidden = true;
    bookDetails.replaceChildren();
    page.classList.remove("page--book-selected");
    page.classList.remove("page--details-qr-ready");
    searchInput.value = "";
    showStatus("Książka została usunięta z biblioteki.");
    bookResults.replaceChildren();
    searchView.hidden = false;
    addView.hidden = true;
  } else if (pendingOperation === "set-status" || pendingOperation === "lend") {
    bookDetailsActions.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
    Object.assign(pendingTargetBook, pendingBook);
    showBookDetails(pendingTargetBook);
    if (pendingOperation === "lend") {
      setBookActionStatus(`Książka została pożyczona: ${pendingBook.borrower}.`);
    } else {
      setBookActionStatus(pendingBook.status === "Na półce"
        ? "Książka została oznaczona jako odłożona na półkę."
        : "Książka została oznaczona jako nieodłożona.");
    }
  }

  pendingBook = undefined;
  pendingTargetBook = undefined;
  pendingQrDataUrl = undefined;
  pendingOperation = undefined;
  booksLoaded = true;
});

printQrButton.addEventListener("click", () => window.print());

homeButton.addEventListener("click", () => {
  stopQrScanner();
  returnScanMode = false;
  pendingScannedCode = undefined;
  scannedCodeUnmatched = false;
  page.classList.remove("page--book-selected");
  page.classList.remove("page--qr-ready");
  page.classList.remove("page--details-qr-ready");
  page.classList.remove("page--return-scanning");
  page.classList.remove("page--advanced-search");
  borrowedBooksView.hidden = true;
  searchView.hidden = true;
  addView.hidden = true;
  actions.hidden = false;
  searchInput.value = "";
  bookResults.replaceChildren();
  bookDetails.replaceChildren();
  bookDetails.hidden = true;
  addBookButton.hidden = true;
  showStatus("");
  addBookForm.reset();
  addBookForm.hidden = false;
  advancedSearchForm.reset();
  advancedSearchForm.hidden = true;
  searchForm.hidden = false;
  qrImage.removeAttribute("src");
  qrImage.alt = "";
  qrCaption.textContent = "";
  qrLabel.hidden = true;
  printQrButton.hidden = true;
  addBookSubmit.disabled = false;
  setAddStatus("");
  homeButton.blur();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && scannerActive) {
    stopQrScanner("Skanowanie zatrzymano po ukryciu strony.");
  }
});
