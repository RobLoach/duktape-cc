# C++ wrapper templates around the Duktape JavaScript Engine (`duktape-cc`)

Duktape is, similar to LUA and TCL, a programming language implementation
optimised for resource restricted platforms, as well as embedding scripting
capabilities into native applications (for details please refer to
[duktape.org](http://duktape.org/) and the corresponding Github repository
[https://github.com/svaarala/duktape](https://github.com/svaarala/duktape)).

The set of c++ templates (with sensible default types) in this repository
facilitates embedding the Duktape ECMA script engine into C++ applications
by providing:

  - A thin wrapper around the C-API of Duktape (`duktape::api` class) as
    basic interfacing layer. This class has only one instance variable, the
    `duk_context` it refers to, so all operations refer to the stack. Methods
    are named after the wrapped `duk_` functions. Only convenience duplicate
    function are omitted:

      ```c++
      duktape::api stack(ctx);
      int top1 = stack.get_top();     // --> duk_get_top(ctx)
      stack.set_top(0);               // --> duk_set_top(ctx, 0)
      stack.push_boolean(true);       // --> duk_push_boolean(ctx_, (duk_bool_t) val)
      stack.push_string("test");      // --> duk_push_lstring(ctx_, ...)
      int i = stack.get_int(1);       // --> duk_get_int(ctx, 1)
      ```

      For more "c++ convenience", type safety and possibilities to implement
      template based functionality, the `duktape::api` also provides c++ style
      methods and template overloads for automatic type selection and conversion:

      ```c++
      // c++ style Duktape API wrappers
      auto top = stack.top();         // --> duk_get_top(ctx)
      stack.top(0);                   // --> duk_set_top(ctx, 0)
      stack.push(true);               // --> duk_push_boolean(ctx_, val), template selected
      stack.push("test");             // --> duk_push_lstring(ctx_, ...), template selected;
      stack.push(vector<int>{1,2,3}); // --> duk_push_array() + duk_push_int() for each element.
      int i = stack.get<int>(1);      // --> duk_get_int(ctx, 1);
      string s = stack.to<string>(0); // --> duk_to_lstring(ctx ...)
      auto buf = stack.buffer<vector<uint8_t>>(1) // --> duk_get_buffer(ctx,1) + type conversion.

      // Added functionality
      string callstack = stack.callstack(); // Returns JS callstack as string
      bool b = stack.is_date(-1);     // Uses instanceof to check if a stack entry is a date object
      bool b = stack.is_regex(-1);    // Uses instanceof to check if a stack entry is a regex object
      stack.set("prop", "value");     // Sets a property of the object on the stack top (index -1)
      ```

    In summary, this class gives you the complete flexibility that the Duktape API provides.

  - Type conversion traits from JavaScript types to C++ types / STL containers are builtin.
    As shown in the examples above, there are type converters from JS to c++ and vice versa for
    all numeric types, `string` and `vector` (`Array`). It is easy to add own conversions, as e.g.
    done in the system module a conversion for `struct ::timespec <--> Date` is added.
    Conversion traits make your implementation more flexible, shorter, and better readable.

  - The class actually instantiating and freeing a Duktape heap is the `duktape::engine` class.
    It creates the heap on construction and frees it on destruction. But this class is also
    the "main control" of the script execution and features, providing only a few methods with
    several overloads. Here you can

      - pick which functionality you like to have in the ECMA script,
      - add own native functions, define constants, etc,
      - evaluate code or run script files and fetch the return values in c++.
      - access the Duktape stack directly using the `stack()` method.

    The class also provides template based "automatic wrapping" of c++ functions and implicit
    selection of arguments passed to the ECMA context depending on the types in c++. A brief
    code snipplet:

      ```c++
        // Step 1: Prepare the functionality of your script engine
        duktape::engine js;                   // Create heap, initialise some basics
        duktape::mod::stdio::define_in(js);   // Pick all functions that the stdio module provides.
        duktape::mod::stdlib::define_in(js);  // Blacklist picking: pick all stdlib functions, ...
        js.undef("exit");                     // ... but not the exit function.
        js.define("my");                      // Define empty global object named "my".
        js.define("my.version", "v1.0.2");    // Define string property in "my".
        js.define("my.answer", 42);           // Define numeric property in "my".
        int top1 = js.stack().top();          // Direct access to the Duktape stack of this engine.
        // [...]

        // Step 2: Run JS code
        string s = js.include<string>(path);  // Run a script, fetch its last statement result.
        js.eval(string_passed_from_app);      // or evaluate code from string

        // Step 3: Analyse results, use JS functions as callbacks, etc etc
        // ... e.g. programmatic app configuration via js:
        string ip = js.call<string>("getConfig", "ip");   // getConfig(key) implemented in script file
        int timeout = js.eval<int>("config.timeout");     // script file sets variables and constants


        void on_message_received(string msg)              // Script implements callback functions for
        { js.call("my.messageCallback", msg); }           // whatever events of the native app.

      ```

  - Optional modules for Linux/BSD/Windows for `stdio`, file system operations, executing
    programs with `stdout`/`stderr`/`stdin` piping, basic user and system information, etc.
    All module features, including basic functionality like `exit()`, `print()`, `alert()`
    and the like, are optional and selectable either individually or as whole module.

  - Exception propagation from ECMA to c++ and vice versa: If a native c++ function throws
    a `std::exception`, this exception is caught and passed to the calling ECMA code as thrown
    `Error`. An ECMA exception/`Error` can be caught as `duktape::script_error` in a normal
    `try-catch` block. Uncaught exceptions are forwarded to the caller, no matter if ECMA
    or c++. This can go up to the first `include()`, `eval()` or `call()` in your engine
    instance - if you don't catch it there the default c++ exception handling applies, aborting
    your application. `duktape::script_error` is derived from `std::exception`.


## Building the CLI application / embedding in your application

A good starting point is to take a look at the Makefile, the CLI application
`main.cc` and the tests. The directory structure looks like:

      duktape-cc/
      ├── cli
      │   ├── example.cc
      │   └── main.cc
      ├── doc
      │   ├── readme.md
      │   └── stdmods.js
      ├── duktape
      │   ├── duk_config.h
      │   ├── duktape.c
      │   ├── duktape.h
      │   ├── duktape.hh
      │   └── mod
      │       ├── mod.fs.hh
      │       ├── [...]
      ├── Makefile
      ├── readme.md
      └── test
          ├── 0001-include
          │   ├── test.cc
          │   └── test.js
          └── [...]

Build notes:

- `duk_config.h`, `duktape.h` and `duktape.c` are the required release
  source code files of the Duktape project (other files in the package
  omitted in this file tree). These files are now included in this
  repository to facilitate building under Windows (without the need of
  missing UNIX tools like wget and xz).

Invoking `make` produces the CLI application as default target:

      $ make
      [c++ ] cli/main.cc  cli/main.o
      [c++ ] duktape/duktape.c  duktape/duktape.o
      [ld  ] cli/main.o duktape/duktape.o  cli/djs
      [note] binary is cli/djs

      # Quick test using inline eval:
      $ ./cli/djs -e 'var a=10; print("-> a is " + a + ".");'
      -> a is 10.

`duktape.c` is compiled with the c++ compiler and `DUK_USE_CPP_EXCEPTIONS` must
be defined (use `throw` instead of `setlongjmp`). This is important because
otherwise the support for c++ exceptions is missing. Compiling manually looks
like

      g++ -c -o cli/main.o cli/main.cc -std=c++11 -Iduktape -I.
      g++ -c -o duktape/duktape.o duktape/duktape.c -std=c++11 -DDUK_USE_CPP_EXCEPTIONS
      g++ -o cli/djs cli/main.o duktape/duktape.o -lm -lrt

(omitted flags that are also used in the Makefile: `-W` `-Wall` `-Wextra`
`-pedantic` `-Os` `-fomit-frame-pointer` `-fdata-sections` `-ffunction-sections`).

## Integrating JS into the C++ application

The `example.cc` shows the main features in detail, at this point
only the "basic implementation style" is briefly depicted.

```c++
#include <duktape/duktape.hh>

using namespace std;

// A native c++ wrapped function
bool native_cpp_function(int a, int b) { return a == b; }

// A duktape c++ API wrapped function
int argument_count1(duktape::api& stack)
{ stack.push(stack.top()); return 1; }

// A Duktape C function
::duk_ret_t argument_count2(::duk_context *ctx)
{ ::duk_push_int(ctx, ::duk_get_top(ctx)); return 1; }

int main(int argc, const char** argv)
{
  // The JS engine with the Duktape heap.
  duktape::engine js;

  // Defining constants and functions in the JS context
  js.define("my");                      // Plain object
  js.define("my.version_major", 1);     // Number
  js.define("my.version_minor", 2.0);   // Number
  js.define("my.builddate", __DATE__ " " __TIME__); // String
  js.define("isEqual", native_cpp_function);
  js.define("my.numArgs1", argument_count1);
  js.define("my.numArgs2", argument_count2);

  // Evaluating code
  cout << js.eval<int>("my.numArgs1(1,2,3,4)") << endl; // --> 4
  cout << js.eval<bool>("isEqual(1,2)") << endl; // --> false

  // Call functions in JS from c++
  cout << js.call<string>("isEqual", 100, 100) << endl; // --> "true"

  // Include script file and return last statement result
  string result = js.include<string>("myscript.js");

  // Exception handling from jJS in C++
  try {
    js.eval<void>("throw new Error('not good');");
  } catch(const duktape::script_error& e) {
    cout << "Caught '" << e.what() << "'" << endl; // --> Caught 'Error: not good'
  }
  return 0;
}
```

## Notes, development context, road map, etc ...

- This project does not intend to be a base for another node.js
  or the like. The focus is set on fast integration. Main application
  fields have been up to now:

    - Implementing scriptable testing applications for libraries
      written in c++.

    - Adding programmatic configuration to an application.

    - Adding scripting hooks/callbacks to C++ applications.

- Duktape was a great help for me when testing functionality in
  embedded systems. During the development and evaluation of this
  class template set (especially the modules) it turned out that
  sequential script execution (which stands in big contrast to e.g.
  node.js and browser ECMA) did lead to small and well readable
  script codes - which is for "tool control language" use cases
  ideal. Also colleagues in the C/C++/Java world like it because
  the basic "code layout" (curly braces, brackets etc) looks similar
  to the latter languages - hence, "it has become our TCL or LUA".

- About conversions of types between JS and C++: The intension is
  to stick with the STL and adding traits for modules only where it
  is needed (but in the modules, not the main duktape.hh). Traits
  are always provided for

    - Numeric types
    - `std::string`       -> String
    - `std::vector<...>`  -> Array

- Duktape release files

    - Initially the release files were separately downloaded
      and extracted from the `tar.xz` archive when invoking
      `make`, but unfortunately people keep having trouble
      with wget, tar and xz on Windows. So they are now included
      as the licenses of the projects are identical.


## List of available builtin functions and objects

### Global namespace

  - exit(status_code)
  - include(path)
  - print(args)
  - alert(args)
  - confirm(text)
  - printf(format, args)
  - sprintf(format, args)


### Console object

  - console.log(args)
  - console.write(args)
  - console.read(arg)


### File system object

  - fs.readfile(path, conf)
  - fs.writefile(path, data)
  - fs.tempnam(prefix)
  - fs.realpath(path)
  - fs.dirname(path)
  - fs.basename(path)
  - fs.mod2str(mode, flags)
  - fs.str2mod(mode)
  - fs.stat(path)
  - fs.size(path)
  - fs.owner(path)
  - fs.group(path)
  - fs.mtime(path)
  - fs.atime(path)
  - fs.ctime(path)
  - fs.exists(path)
  - fs.isfile(path)
  - fs.isdir(path)
  - fs.islink(path)
  - fs.isfifo(path)
  - fs.iswritable(path)
  - fs.isreadable(path)
  - fs.isexecutable(path)
  - fs.readlink(path)
  - fs.chdir(path)
  - fs.mkdir(path, options)
  - fs.rmdir(path)
  - fs.unlink(path)
  - fs.utime(path, mtime, atime)
  - fs.rename(path, new_path)
  - fs.symlink(path, link_path)
  - fs.hardlink(path, link_path)
  - fs.chmod(path, mode)
  - fs.readdir(path)
  - fs.glob(pattern)
  - fs.find(path, options, filter)
  - fs.move(source_path, target_path)
  - fs.copy(source_path, target_path, options)
  - fs.remove(target_path, options)
  - fs.file(path, openmode)
  - fs.file.open(path, openmode)
  - fs.file.read(max_size)
  - fs.file.write(data)
  - fs.file.writeln(data)
  - fs.file.printf(format, args)
  - fs.file.seek(position, whence)
  - fs.file.lock(access)


### System object

  - sys.user(uid)
  - sys.group(gid)
  - sys.sleep(seconds)
  - sys.clock(clock_source)
  - sys.isatty(descriptorName)
  - sys.exec(program, arguments, options)
  - sys.shell(command)
  - sys.hash.crc8(data)
  - sys.hash.crc16(data)
  - sys.hash.crc32(data)
  - sys.hash.md5(data, isfile)
  - sys.hash.sha1(data, isfile)
  - sys.hash.sha1(data, isfile)
