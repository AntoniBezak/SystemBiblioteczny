var BOOKS_API_VERSION = "2026-10-25-lending-1";
var VALID_BOOK_STATUSES = ["Na półce", "Nie odłożona", "Pożyczona"];

function setupBookApi() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();

  PropertiesService.getScriptProperties().setProperties({
    BOOKS_SPREADSHEET_ID: spreadsheet.getId(),
    BOOKS_SHEET_NAME: sheet.getName(),
  });
}

function doPost(event) {
  const values = event && event.parameter;
  const requestId = values && values.requestId;
  const action = values && values.action || "create";

  try {
    if (!values) {
      throw new Error("Brak danych formularza.");
    }
    if (["version", "create", "update", "delete", "set-status", "lend"].indexOf(action) === -1) {
      throw new Error("Nieznany rodzaj operacji.");
    }
    if (action === "version") {
      return makeBookApiResponse({ ok: true, requestId: requestId });
    }

    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty("BOOKS_SPREADSHEET_ID");
    const sheetName = properties.getProperty("BOOKS_SHEET_NAME");
    if (!spreadsheetId || !sheetName) {
      throw new Error("Najpierw uruchom konfigurację skryptu w arkuszu.");
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
      if (!sheet) {
        throw new Error("Nie znaleziono skonfigurowanej zakładki arkusza.");
      }

      const headers = getBookHeaders(sheet);
      const target = action === "create" ? null : getBookFields(values, "target");
      const rowNumber = action === "create" ? 0 : findBookRow(sheet, headers, target);

      if (action === "create") {
        const book = getBookFields(values, "");
        book.status = validateBookStatus(book.status || "Na półce");
        const newRow = headers.map(function (header) {
          const field = getBookFieldForHeader(header);
          const value = field ? book[field] : undefined;
          return value === undefined ? "" : sanitizeBookCell(value);
        });
        sheet.appendRow(newRow);
      } else if (action === "update") {
        const book = getBookFields(values, "");
        book.status = validateBookStatus(book.status || "Na półce");
        Object.keys(book).forEach(function (header) {
          const columnIndex = headers.indexOf(getBookHeaderForField(header));
          if (columnIndex === -1) {
            return;
          }
          sheet.getRange(rowNumber, columnIndex + 1)
            .setValue(sanitizeBookCell(book[header]));
        });
      } else if (action === "set-status") {
        const statusColumn = headers.indexOf("status");
        sheet.getRange(rowNumber, statusColumn + 1)
          .setValue(validateBookStatus(values.status));
        if (values.status === "Na półce") {
          sheet.getRange(rowNumber, headers.indexOf("borrower") + 1).setValue("");
        }
      } else if (action === "lend") {
        const currentStatus = String(sheet.getRange(rowNumber, headers.indexOf("status") + 1).getDisplayValue()).trim();
        if (currentStatus !== "Na półce") {
          throw new Error("Można pożyczyć tylko książkę oznaczoną jako „Na półce”.");
        }
        const borrower = typeof values.borrower === "string" ? values.borrower.trim() : "";
        if (!borrower) {
          throw new Error("Podaj imię i nazwisko osoby wypożyczającej książkę.");
        }
        if (borrower.length > 200) {
          throw new Error("Imię i nazwisko nie może przekraczać 200 znaków.");
        }
        sheet.getRange(rowNumber, headers.indexOf("status") + 1).setValue("Pożyczona");
        sheet.getRange(rowNumber, headers.indexOf("borrower") + 1)
          .setValue(sanitizeBookCell(borrower));
      } else {
        sheet.deleteRow(rowNumber);
      }
    } finally {
      lock.releaseLock();
    }

    return makeBookApiResponse({ ok: true, requestId: requestId });
  } catch (error) {
    console.error(error);
    return makeBookApiResponse({
      ok: false,
      message: error.message || "Nie udało się dodać książki.",
      requestId: requestId,
    });
  }
}

function getBookHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    throw new Error("Arkusz nie zawiera wiersza nagłówków.");
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function (header) {
      return header.trim().toLowerCase();
    });
  const requiredHeaders = [
    "title",
    "author",
    "color1",
    "color2",
    "column",
    "row",
    "location",
    "publication date",
    "publishing house",
    "illustrator",
    "status",
    "borrower",
  ];
  const missingHeaders = requiredHeaders.filter(function (header) {
    return headers.indexOf(header) === -1;
  });
  if (missingHeaders.length > 0) {
    throw new Error("W arkuszu brakuje wymaganych kolumn: " + missingHeaders.join(", "));
  }
  return headers;
}

function getBookFields(values, prefix) {
  const requiredFields = ["title", "author", "color1", "color2", "column", "row", "location"];
  const optionalFields = ["publicationDate", "publishingHouse", "illustrator", "status", "borrower"];
  const fields = requiredFields.concat(optionalFields);
  const book = {};

  fields.forEach(function (field) {
    const parameter = prefix ? prefix + field.charAt(0).toUpperCase() + field.slice(1) : field;
    const value = values[parameter];
    const isRequired = requiredFields.indexOf(field) !== -1;
    if (typeof value !== "string" || (!prefix && isRequired && !value.trim())) {
      if (isRequired) {
        throw new Error("Uzupełnij wszystkie wymagane pola książki.");
      }
      book[field] = "";
      return;
    }
    if (value.length > 250) {
      throw new Error("Jedna z wartości przekracza dozwoloną długość.");
    }
    book[field] = value.trim();
  });
  return book;
}

function validateBookStatus(status) {
  if (VALID_BOOK_STATUSES.indexOf(status) === -1) {
    throw new Error("Nieprawidłowy status książki.");
  }
  return status;
}

function getBookHeaderForField(field) {
  const headersByField = {
    publicationDate: "publication date",
    publishingHouse: "publishing house",
    illustrator: "illustrator",
  };
  return headersByField[field] || field.toLowerCase();
}

function getBookFieldForHeader(header) {
  const fieldsByHeader = {
    "publication date": "publicationDate",
    "publishing house": "publishingHouse",
    illustrator: "illustrator",
  };
  return fieldsByHeader[header] || header;
}

function findBookRow(sheet, headers, target) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error("Książka nie została znaleziona w arkuszu.");
  }

  const targetFields = Object.keys(target).filter(function (field) {
    return headers.indexOf(getBookHeaderForField(field)) !== -1;
  });
  const columnIndexes = targetFields.map(function (field) {
    return headers.indexOf(getBookHeaderForField(field));
  });
  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();
  const matches = [];
  rows.forEach(function (row, index) {
    const isMatch = targetFields.every(function (field, fieldIndex) {
      return String(row[columnIndexes[fieldIndex]]).trim() === target[field];
    });
    if (isMatch) {
      matches.push(index + 2);
    }
  });

  if (matches.length === 0) {
    throw new Error("Książka nie została znaleziona w arkuszu. Odśwież dane i spróbuj ponownie.");
  }
  if (matches.length > 1) {
    throw new Error("W arkuszu znaleziono kilka identycznych wpisów. Zmiana lub usunięcie nie zostały wykonane.");
  }
  return matches[0];
}

function sanitizeBookCell(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function makeBookApiResponse(result) {
  const message = JSON.stringify({
    type: "book-submit-result",
    ok: result.ok,
    message: result.message || "",
    requestId: result.requestId || "",
    apiVersion: BOOKS_API_VERSION,
  }).replace(/</g, "\\u003c");
  const html = '<!doctype html><html><body><script>'
    + "window.top.postMessage(" + message + ", '*');"
    + "</script></body></html>";

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
