class TrackingSheetWrapper {
  // Wrapper around the tracking sheet.

  constructor(){
    var globvar = globalVariables();
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    this.sheet = spreadsheet.getSheetByName(globvar['TRACKING_SHEETNAME']);
    this.columns = globvar["SHEET_COL_ORDER"];
    this.machine_writable_columns = globvar["MACHINE_WRITABLE_COLS"];
    this.numColumns = this.columns.length;
    this.UNIQUEID_START_VAL = globvar['UNIQUEID_START_VAL'];
    this.UNIQUEID_START_ROWINDEX = globvar['UNIQUEID_START_ROWINDEX'];
  }
  
  getRowByRowNumber(rowNumber){
    // Return a row object based on row number.
    var rowArray = this.sheet.getRange(rowNumber, 1, 1, this.numColumns).getValues();
    rowArray = rowArray[0];  // Shape [1, R] -> [R]
    var row = {};
    for (var i = 0; i < this.columns.length; i++) {
      row[this.columns[i]] = rowArray[i];
    }
    return row;
  }
  
  getRowByUniqueID(id){
    // Returns a row object based on uniqueid.
    return this.getRowByRowNumber(
      getRowNumberByUniqueID(id, this.UNIQUEID_START_VAL, this.UNIQUEID_START_ROWINDEX));
  }
  
  writeRow(row){
    // Writes a row object to the tracking sheet based on it's unique id.
    // "row" needs to contain a uniqueid.
    // all other elements with keys in machine_writable_columns will be written to the sheet.
    var rowNumber = getRowNumberByUniqueID(row.uniqueid, this.UNIQUEID_START_VAL, this.UNIQUEID_START_ROWINDEX);
    var existingRow = this.getRowByUniqueID(row.uniqueid);
    if (existingRow.uniqueid != row.uniqueid){
      throw "Attempting to write to row with unmatching uniqueids. id: " + row.uniqueid;
    }
    
    for (var i = 0; i < this.columns.length; i++) {
      if (this.machine_writable_columns.indexOf(this.columns[i]) != -1){
        var value = row[this.columns[i]];
        if (value !== null){
          // We need the +1 in the column here because columns are indexed from 1....
          this.sheet.getRange(rowNumber, i+1).setValue(value);
        }
      }
    }
  }
}


class LogSheetWrapper {
  // Wrapper around the logging sheet.

  constructor(){
    var globvar = globalVariables();
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    this.sheet = spreadsheet.getSheetByName(globvar['LOG_SHEETNAME']);  
  }
  
  appendRow(row){
    // Append array row to the end of the sheet.
    var row_log = this.sheet.getLastRow();
    this.sheet.getRange(row_log+1,1,1, row.length).setValues([row]);
  }
}

