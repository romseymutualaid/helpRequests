class TrackingSheetWrapper {
  // Wrapper around the tracking sheet.

  constructor(sheet){
    var globvar = globalVariables();
    this.sheet = (
      sheet !== undefined ? sheet : 
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(globvar['TRACKING_SHEETNAME'])
    );
    this.columns = globvar["SHEET_COL_ORDER"];
    this.machine_writable_columns = globvar["MACHINE_WRITABLE_COLS"];
    this.numColumns = this.columns.length;
    this.UNIQUEID_START_VAL = globvar['UNIQUEID_START_VAL'];
    this.UNIQUEID_START_ROWINDEX = globvar['UNIQUEID_START_ROWINDEX'];
  }
  
  makeRowObject(rowArray){
    // Make a row object from a row array.
    var row = {};
    for (var i = 0; i < this.columns.length; i++) {
      row[this.columns[i]] = rowArray[i].toString();
    }
    return row;
  }

  getAllRows(){
    // Return all the sheet's rows as an array of row objects.
    // This is much faster than getting the data one row at a time.
    var rowArray2D = this.sheet.getDataRange().getValues();
    var rows = [];
    var myScope = this; // for use of current scope in forEach
    rowArray2D.forEach(function(rowArray,index){
      rows[index]=myScope.makeRowObject(rowArray);
    });
    return rows;
  }

  getRowByRowNumber(rowNumber){
    // Return a row object based on row number.
    var rowArray = this.sheet.getRange(rowNumber, 1, 1, this.numColumns).getValues();
    rowArray = rowArray[0];  // Shape [1, R] -> [R]
    return this.makeRowObject(rowArray);
  }
  
  getRowByUniqueID(id){
    // Returns a row object based on uniqueid.
    return this.getRowByRowNumber(
      getRowNumberByUniqueID(
        id, this.UNIQUEID_START_VAL, this.UNIQUEID_START_ROWINDEX));
  }
  
  writeRow(row){
    // Writes a row object to the tracking sheet based on it's unique id.
    // "row" needs to contain a uniqueid.
    // all other elements with keys in machine_writable_columns will be written 
    // to the sheet.
    var rowNumber = getRowNumberByUniqueID(
      row.uniqueid, this.UNIQUEID_START_VAL, this.UNIQUEID_START_ROWINDEX);
    var existingRow = this.getRowByUniqueID(row.uniqueid);
    if (existingRow.uniqueid != row.uniqueid){
      throw new Error(uniqueIDlookupIsCorruptedMessage(existingRow, row));
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

  constructor(sheet){
    var globvar = globalVariables();
    this.sheet = (
      sheet !== undefined ? sheet : 
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(globvar['LOG_SHEETNAME'])
    );
  }
  
  appendFormattedRow(msg){
    var row = this.makeFormattedRow(msg);
    this.sheet.appendRow(row);
  }
  
  makeFormattedRow(msg){
    return [new Date(), msg.uniqueid, msg.userid, msg.type, msg.subtype,
            msg.additionalInfo];
  }
}

