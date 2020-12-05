//****************************************
// sheet functions
//****************************************

function getUniqueIDbyRowNumber(row, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX){
  // assumes: tracking sheet rows are sorted by contiguous increasing request-number
  var uniqueid = +row + UNIQUEID_START_VAL - UNIQUEID_START_ROWINDEX;
  return(uniqueid.toString());
}

function getRowNumberByUniqueID(uniqueid, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX){
  // assumes: tracking sheet rows are sorted by contiguous increasing request-number
  var row = +uniqueid - UNIQUEID_START_VAL +UNIQUEID_START_ROWINDEX;
  return(row);
}

//****************************************
// slack formatting functions
// For more slack formating, see:
// https://api.slack.com/tools/block-kit-builder
//****************************************

/**
 * Create a json string in slack block format for text.
 * @param {string} text
 * @param {boolean} ephemeral
 * @param {string} type
 */
var textToJsonBlocks = function(text, ephemeral=true, type="mrkdwn"){
  var blocks = {
    "blocks": [
      {
        "type": "section",
        "text": {
          "text": text,
          "type": type,
        }
      }
    ],
  };

  if (ephemeral){
    blocks["response_type"] = "ephemeral";
    blocks["replace_original"] = false;
  }

  return JSON.stringify(blocks);
}

//****************************************
// string functions
//****************************************


var extractMatchOrThrowError = function(str, regexp, msg_empty_str, msg_nomatch_str){
  if (!str || str == ''){
    throw new Error(msg_empty_str);
  }
    
  var re_match = new RegExp(regexp).exec(str);
  // RegExp.exec returns array if match (null if not). 
  // First element is matched string, following elements are matched groupings.
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
    return dt.getDate() + '/' + (dt.getMonth() + 1) +'/'+ dt.getFullYear();
    // DD/MM/YYYY
  }
}

//****************************************
// array functions
//****************************************


var emptyStringArray = function(rows, cols) {
    var arr = new Array(rows);
    for (var i = 0; i < rows; i++) {
        arr[i] = new Array(cols).fill("");
    }
    return arr;
}

var tryParseJSON = function(jsonString){
  // from https://stackoverflow.com/questions/3710204/how-to-check-if-a-string-is-a-valid-json-string-in-javascript-without-using-try
    try {
        var o = JSON.parse(jsonString);

        // Handle non-exception-throwing cases:
        // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
        // but... JSON.parse(null) returns null, and typeof null === "object", 
        // so we must check for that, too. Thankfully, null is falsey, so this suffices:
        if (o && typeof o === "object") {
            return o;
        }
    }
    catch (e) { }

    return false;
};