#!/usr/bin/djs

/**
 * Removes indentation spaces on all lines of the given text.
 * @param {string} text
 * @returns {string}
 */
function unindent(text) {
  // Remove indent and append function documentation, could maybe be done better ...
  var min_leading_spaces = -1;
  var lines = text.replace(/[\s]+$/g, "").replace(/\t/g, " ").split("\n");
  for(var i in lines) {
    if(!lines[i].length) continue;
    var p = lines[i].search(/[^\s]/);
    if((p >= 0) && ((p < min_leading_spaces) || (min_leading_spaces < 0))) {
      min_leading_spaces = p;
    }
  }
  if(min_leading_spaces > 0) {
    for(var i in lines) {
      if(lines[i].length > min_leading_spaces) {
        lines[i] = lines[i].substr(min_leading_spaces);
      }
    }
  }
  return lines.join("\n");
}

/**
 * Generates JSDoc from the corresponding sections in the ".hh" files of the modules.
 * Note: Done in one go: fs.find() has a filter callback for each file, in which the
 *       files are directly read. While reading using fs.readfile(), the line filter
 *       callback is used to directly compose the relevant JSDoc sections.
 *
 * @returns {String}
 */
function scan_js_docs() {
  var jsdocs = "";
  fs.find(fs.realpath(fs.dirname(fs.dirname(fs.realpath(sys.script))) + fs.directoryseparator + "duktape"), {
    name:"*.hh",
    type:"f",
    filter: function(path) {
      var doc_span = "";
      var is_doc_span = false;
      fs.readfile(path, function(line) {
        line = line.replace(/[\s]+$/, "");
        if(line != "") {
          if(line.search(/^[\s]*?#if[\s]*?\([\s]*?0[\s]*?&&[\s]*?JSDOC[\s]*?\)/) >= 0) {
            doc_span = "";
            is_doc_span = true;
          } else if(line.search(/^[\s]*?#endif[\s]*?$/) >= 0) {
            if(is_doc_span) {
              doc_span = doc_span.replace(/[\s]+$/g,"").replace(/^[\r\n]+/g,"");
              jsdocs += unindent(doc_span) + "\n\n";
            }
            doc_span = "";
            is_doc_span = false;
          } else if(is_doc_span) {
            doc_span += line + "\n";
          }
        }
      });
    }
  });
  return jsdocs.replace(/[\s]+$/, "") + "\n";
}

// result to stdout
print(scan_js_docs());
