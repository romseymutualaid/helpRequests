//****************************************
// sheet functions
//****************************************

function getUniqueIDbyRowNumber(row, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX){
  var uniqueid = +row + UNIQUEID_START_VAL - UNIQUEID_START_ROWINDEX; // assumes: tracking sheet rows are sorted by contiguous increasing request-number
  return(uniqueid);
}

function getRowNumberByUniqueID(uniqueid, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX){
  var row = +uniqueid - UNIQUEID_START_VAL +UNIQUEID_START_ROWINDEX; // assumes: tracking sheet rows are sorted by contiguous increasing request-number
  return(row);
}


//****************************************
// string functions
//****************************************


var extractMatchOrThrowError = function(str, regexp, msg_empty_str, msg_nomatch_str){
  if (!str || str == ''){
    throw new Error(msg_empty_str);
  }
    
  var re_match = new RegExp(regexp).exec(str); // RegExp.exec returns array if match (null if not). First element is matched string, following elements are matched groupings.
  if (!re_match){
    throw new Error(msg_nomatch_str);
  }
  
  return re_match;
}

var isVarInArray = function(variable, array){
  return array.includes(variable);
}

function stripStartingNumbers(s){
  // Strip starting numbers from a string.
  // Use to remove house numbers when posting publically.
  var re = new RegExp(/^[\s\d]+/);
  return s.replace(re, "");
}

function formatDate(date) {
  if (date == "" || date === null || date === undefined) {
    return "None Given";
  } else {
    var dt = new Date(date);
    return dt.getDate() + '/' + (dt.getMonth() + 1) +'/'+ dt.getFullYear( ); // DD/MM/YYYY
  }
}