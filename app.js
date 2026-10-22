const actions = document.querySelector(".actions");
const page = document.querySelector(".page");
const homeButton = document.querySelector(".home-button");
const searchView = document.querySelector(".search-view");
const addView = document.querySelector(".add-view");
const searchInput = document.querySelector("#book-search");
const searchForm = document.querySelector(".search-form");
const qrScanner = document.querySelector(".qr-scanner");
const qrScannerVideo = document.querySelector(".qr-scanner__video");
const qrScannerStatus = document.querySelector(".qr-scanner__status");
const searchAction = document.querySelector('[data-action="search"]');
const returnAction = document.querySelector('[data-action="return"]');
const addAction = document.querySelector('[data-action="add"]');
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
const advancedFunctionsStatus = document.querySelector(".advanced-functions__status");
const bulkQrPrint = document.querySelector(".bulk-qr-print");
const booksUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT62yhghPmouKRZLZ2EuJL6gWEyj_dH-VLSv7_gboYX84xUVuDMIBCzMkEF3xPxzzdaGMtb2CpkA3lu/pub?output=csv";
const booksApiUrl = window.BOOKS_API_URL ?? "";
let books = [];
let booksLoaded = false;
let booksLoadPromise;
let lookupMode = "search";
let addRequestTimer;
let addRequestPending = false;
let pendingRequestId;
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

  const requiredHeaders = ["title", "author", "color1", "color2", "column", "row", "location"];
  if (requiredHeaders.some((header) => !headers.includes(header))) {
    throw new Error("Plik CSV musi zawierać kolumny Title, Author, Color1, Color2, Column, Row i Location.");
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

function showStatus(message) {
  searchStatus.textContent = message;
  searchStatus.hidden = message === "";
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

  const fields = [
    ["Szafka", book.location],
    ["Kolumna", book.column],
    ["Półka", book.row],
  ];
  if (lookupMode === "search") {
    fields.push(["Kolor grzbietu", book.color]);
  }
  const list = document.createElement("dl");
  list.className = "book-details__fields";

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
  bookDetailsQrCaption.textContent = book.title;
  bookDetails.hidden = false;
  page.classList.add("page--book-selected");
  heading.focus();
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

function loadBooks(forceRefresh = false) {
  if (booksLoaded && !forceRefresh) {
    if (pendingScannedCode) {
      const scannedCode = pendingScannedCode;
      pendingScannedCode = undefined;
      handleScannedCode(scannedCode);
    } else if (!returnScanMode) {
      renderResults();
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
        renderResults();
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
  addBookForm.elements.requestId.value = pendingRequestId;
  addBookForm.elements.action.value = operation;

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
    setBookActionStatus("Usuwanie książki…");
  }
  HTMLFormElement.prototype.submit.call(addBookForm);

  window.clearTimeout(addRequestTimer);
  addRequestTimer = window.setTimeout(() => {
    addRequestPending = false;
    addBookSubmit.disabled = false;
    if (pendingOperation === "delete") {
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
  lookupMode = mode;
  returnScanMode = mode === "return";
  pendingScannedCode = undefined;
  scannedCodeUnmatched = false;
  addView.hidden = true;
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

searchAction.addEventListener("click", () => startLookup("search"));
returnAction.addEventListener("click", () => startLookup("return"));
addAction.addEventListener("click", () => startAddBook());
addBookButton.addEventListener("click", () =>
  startAddBook(scannedCodeUnmatched ? "" : searchInput.value.trim())
);
printAllQrButton.addEventListener("click", printAllBookQrs);
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

  window.clearTimeout(addRequestTimer);
  if (!addRequestPending) {
    return;
  }
  addRequestPending = false;
  pendingRequestId = undefined;
  addBookSubmit.disabled = false;

  if (!event.data.ok) {
    const errorMessage = event.data.message || "Operacja nie powiodła się.";
    if (pendingOperation === "delete") {
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
