<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * File handling in moodlecheck
 *
 * @package    local_moodlecheck
 * @copyright  2012 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die;

/**
 * Handles one file with behat step definitions
 *
 * @package    tool_behateditor
 * @copyright  2012 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class tool_behateditor_file {
    protected $filepath = null;
    protected $needsvalidation = null;
    protected $errors = null;
    protected $tokens = null;
    protected $tokenscount = 0;
    protected $classes = null;
    protected $functions = null;
    protected $filephpdocs = null;
    protected $allphpdocs = null;
    protected $variables = null;
    protected $defines = null;
    protected $constants = null;

    /**
     * Creates an object from path to the file
     *
     * @param string $filepath
     */
    public function __construct($filepath) {
        $this->filepath = $filepath;
    }

    /**
     * Cleares all cached stuff to free memory
     */
    protected function clear_memory() {
        $this->tokens = null;
        $this->tokenscount = 0;
        $this->classes = null;
        $this->functions = null;
        $this->filephpdocs = null;
        $this->allphpdocs = null;
        $this->variables = null;
        $this->defines = null;
        $this->constants = null;
    }

    /**
     * Returns true if this file is inside specified directory
     *
     * @param string $dirpath
     * @return bool
     */
    public function is_in_dir($dirpath) {
        if (substr($dirpath, -1) != '/') {
            $dirpath .= '/';
        }
        return substr($this->filepath, 0, strlen($dirpath)) == $dirpath;
    }

    /**
     * Retuns true if the file needs validation (is PHP file)
     *
     * @return bool
     */
    public function needs_validation() {
        if ($this->needsvalidation === null) {
            $this->needsvalidation = true;
            $pathinfo = pathinfo($this->filepath);
            if (empty($pathinfo['extension']) || ($pathinfo['extension'] != 'php' && $pathinfo['extension'] != 'inc')) {
                $this->needsvalidation = false;
            }
        }
        return $this->needsvalidation;
    }

    /**
     * Validates a file over registered rules and returns an array of errors
     *
     * @return array
     */
    public function validate() {
        if ($this->errors !== null) {
            return $this->errors;
        }
        $this->errors = array();
        if (!$this->needs_validation()) {
            return $this->errors;
        }
        foreach (local_moodlecheck_registry::get_enabled_rules() as $code => $rule) {
            $ruleerrors = $rule->validatefile($this);
            if (count($ruleerrors)) {
                $this->errors = array_merge($this->errors, $ruleerrors);
            }
        }
        $this->clear_memory();
        return $this->errors;
    }

    /**
     * Returns a file contents converted to array of tokens.
     *
     * Each token is an array with two elements: code of token and text
     * For simple 1-character tokens the code is -1
     *
     * @return array
     */
    public function &get_tokens() {
        if ($this->tokens === null) {
            $source = file_get_contents($this->filepath);
            $this->tokens = token_get_all($source);
            $this->tokenscount = count($this->tokens);
            $inquotes = -1;
            for ($tid=0; $tid<$this->tokenscount; $tid++) {
               if (is_string($this->tokens[$tid])) {
                   // simple 1-character token
                   $this->tokens[$tid] = array(-1, $this->tokens[$tid]);
               }
               // and now, for the purpose of this project we don't need strings with variables inside to be parsed
               // so when we find string in double quotes that is split into several tokens and combine all content in one token
               if ($this->tokens[$tid][0] == -1 && $this->tokens[$tid][1] == '"') {
                   if ($inquotes == -1) {
                       $inquotes = $tid;
                       $this->tokens[$tid][0] = T_STRING;
                   } else {
                       $this->tokens[$inquotes][1] .= $this->tokens[$tid][1];
                       $this->tokens[$tid] = array(T_WHITESPACE, '');
                       $inquotes = -1;
                   }
               } else if ($inquotes > -1) {
                   $this->tokens[$inquotes][1] .= $this->tokens[$tid][1];
                   $this->tokens[$tid] = array(T_WHITESPACE, '');
               }
            }
        }
        return $this->tokens;
    }

    /**
     * Returns all classes found in file
     *
     * Returns array of objects where each element represents a class:
     * $class->name : name of the class
     * $class->tagpair : array of two elements: id of token { for the class and id of token } (false if not found)
     * $class->phpdocs : phpdocs for this class (instance of tool_behateditor_phpdocs or false if not found)
     * $class->boundaries : array with ids of first and last token for this class
     *
     * @return array
     */
    public function &get_classes() {
        if ($this->classes === null) {
            $this->classes = array();
            $tokens = &$this->get_tokens();
            for ($tid=0;$tid<$this->tokenscount;$tid++) {
                if ($this->tokens[$tid][0] == T_CLASS) {
                    $class = new stdClass();
                    $class->tid = $tid;
                    $class->name = $this->next_nonspace_token($tid);
                    $class->phpdocs = $this->find_preceeding_phpdoc($tid);
                    $class->tagpair = $this->find_tag_pair($tid, '{', '}');
                    $class->boundaries = $this->find_object_boundaries($class);
                    $this->classes[] = $class;
                }
            }
        }
        return $this->classes;
    }

    /**
     * Returns all functions (including class methods) found in file
     *
     * Returns array of objects where each element represents a function:
     * $function->tid : token id of the token 'function'
     * $function->name : name of the function
     * $function->phpdocs : phpdocs for this function (instance of tool_behateditor_phpdocs or false if not found)
     * $function->class : containing class object (false if this is not a class method)
     * $function->fullname : name of the function with class name (if applicable)
     * $function->accessmodifiers : tokens like static, public, protected, abstract, etc.
     * $function->tagpair : array of two elements: id of token { for the function and id of token } (false if not found)
     * $function->argumentstoken : array of tokens found inside function arguments
     * $function->arguments : array of function arguments where each element is array(typename, variablename)
     * $function->boundaries : array with ids of first and last token for this function
     *
     * @return array
     */
    public function &get_functions() {
        if ($this->functions === null) {
            $this->functions = array();
            $tokens = &$this->get_tokens();
            for ($tid=0; $tid<$this->tokenscount; $tid++) {
                if ($this->tokens[$tid][0] == T_FUNCTION) {
                    $function = new stdClass();
                    $function->tid = $tid;
                    $function->fullname = $function->name = $this->next_nonspace_token($tid, false, array('&'));

                    // Skip anonymous functions.
                    if ($function->name == '(') {
                        continue;
                    }
                    $function->phpdocs = $this->find_preceeding_phpdoc($tid);
                    $function->class = $this->is_inside_class($tid);
                    if ($function->class !== false) {
                        $function->fullname = $function->class->name . '::' . $function->name;
                    }
                    $function->accessmodifiers = $this->find_access_modifiers($tid);
                    if (!in_array(T_ABSTRACT, $function->accessmodifiers)) {
                        $function->tagpair = $this->find_tag_pair($tid, '{', '}');
                    } else {
                        $function->tagpair = false;
                    }
                    $argumentspair = $this->find_tag_pair($tid, '(', ')', array('{', ';'));
                    if ($argumentspair !== false && $argumentspair[1] - $argumentspair[0] > 1) {
                        $function->argumentstokens = $this->break_tokens_by( array_slice($tokens, $argumentspair[0] + 1, $argumentspair[1] - $argumentspair[0] - 1) );
                    } else {
                        $function->argumentstokens = array();
                    }
                    $function->arguments = array();
                    foreach ($function->argumentstokens as $argtokens) {
                        $type = null;
                        $variable = null;
                        for ($j=0; $j<count($argtokens); $j++) {
                            if ($argtokens[$j][0] == T_VARIABLE) {
                                $variable = $argtokens[$j][1];
                                break;
                            } else if ($argtokens[$j][0] != T_WHITESPACE && $argtokens[$j][1] != '&') {
                                $type = $argtokens[$j][1];
                            }
                        }
                        $function->arguments[] = array($type, $variable);
                    }
                    $function->boundaries = $this->find_object_boundaries($function);
                    $this->functions[] = $function;
                }
            }
        }
        return $this->functions;
    }

    /**
     * Returns all class properties (variables) found in file
     *
     * Returns array of objects where each element represents a variable:
     * $variable->tid : token id of the token with variable name
     * $variable->name : name of the variable (starts with $)
     * $variable->phpdocs : phpdocs for this variable (instance of tool_behateditor_phpdocs or false if not found)
     * $variable->class : containing class object
     * $variable->fullname : name of the variable with class name (i.e. classname::$varname)
     * $variable->accessmodifiers : tokens like static, public, protected, abstract, etc.
     * $variable->boundaries : array with ids of first and last token for this variable
     *
     * @return array
     */
    public function &get_variables() {
        if ($this->variables === null) {
            $this->variables = array();
            $this->get_tokens();
            for ($tid=0; $tid<$this->tokenscount; $tid++) {
                if ($this->tokens[$tid][0] == T_VARIABLE && ($class = $this->is_inside_class($tid)) && !$this->is_inside_function($tid)) {
                    $variable = new stdClass;
                    $variable->tid = $tid;
                    $variable->name = $this->tokens[$tid][1];
                    $variable->class = $class;
                    $variable->fullname = $class->name . '::' . $variable->name;
                    $variable->accessmodifiers = $this->find_access_modifiers($tid);
                    $variable->phpdocs = $this->find_preceeding_phpdoc($tid);
                    $variable->boundaries = $this->find_object_boundaries($variable);
                    $this->variables[] = $variable;
                }
            }
        }
        return $this->variables;
    }

    /**
     * Returns all constants found in file
     *
     * Returns array of objects where each element represents a constant:
     * $variable->tid : token id of the token with variable name
     * $variable->name : name of the variable (starts with $)
     * $variable->phpdocs : phpdocs for this variable (instance of tool_behateditor_phpdocs or false if not found)
     * $variable->class : containing class object
     * $variable->fullname : name of the variable with class name (i.e. classname::$varname)
     * $variable->boundaries : array with ids of first and last token for this constant
     *
     * @return array
     */
    public function &get_constants() {
        if ($this->constants === null) {
            $this->constants = array();
            $this->get_tokens();
            for ($tid=0; $tid<$this->tokenscount; $tid++) {
                if ($this->tokens[$tid][0] == T_CONST && !$this->is_inside_function($tid)) {
                    $variable = new stdClass;
                    $variable->tid = $tid;
                    $variable->fullname = $variable->name = $this->next_nonspace_token($tid, false);
                    $variable->class = $this->is_inside_class($tid);
                    if ($variable->class !== false) {
                        $variable->fullname = $variable->class->name . '::' . $variable->name;
                    }
                    $variable->phpdocs = $this->find_preceeding_phpdoc($tid);
                    $variable->boundaries = $this->find_object_boundaries($variable);
                    $this->constants[] = $variable;
                }
            }
        }
        return $this->constants;
    }

    /**
     * Returns all 'define' statements found in file
     *
     * Returns array of objects where each element represents a define statement:
     * $variable->tid : token id of the token with variable name
     * $variable->name : name of the variable (starts with $)
     * $variable->phpdocs : phpdocs for this variable (instance of tool_behateditor_phpdocs or false if not found)
     * $variable->class : containing class object
     * $variable->fullname : name of the variable with class name (i.e. classname::$varname)
     * $variable->boundaries : array with ids of first and last token for this constant
     *
     * @return array
     */
    public function &get_defines() {
        if ($this->defines === null) {
            $this->defines = array();
            $this->get_tokens();
            for ($tid=0; $tid<$this->tokenscount; $tid++) {
                if ($this->tokens[$tid][0] == T_STRING && $this->tokens[$tid][1] == 'define' && !$this->is_inside_function($tid) && !$this->is_inside_class($tid)) {
                    $next1id = $this->next_nonspace_token($tid, true);
                    $next1 = $this->next_nonspace_token($tid, false);
                    $next2 = $this->next_nonspace_token($next1id, false);
                    $variable = new stdClass;
                    $variable->tid = $tid;
                    if ($next1 == '(' && preg_match("/^(['\"])(.*)\\1$/", $next2, $matches)) {
                        $variable->fullname = $variable->name = $matches[2];
                    }
                    $variable->phpdocs = $this->find_preceeding_phpdoc($tid);
                    $variable->boundaries = $this->find_object_boundaries($variable);
                    $defines[] = $variable;
                }
            }
        }
        return $this->defines;
    }

    /**
     * Finds and returns object boundaries
     *
     * $obj is an object representing function, class or variable. This function
     * returns token ids for the very first token applicable to this object
     * to the very last
     *
     * @param stdClass $obj
     * @return array
     */
    public function find_object_boundaries($obj) {
        $boundaries = array($obj->tid, $obj->tid);
        $tokens = &$this->get_tokens();
        if (!empty($obj->tagpair)) {
            $boundaries[1] = $obj->tagpair[1];
        } else {
            // find the next ;
            for ($i=$boundaries[1]; $i<$this->tokenscount; $i++) {
                if ($tokens[$i][1] == ';') {
                    $boundaries[1] = $i;
                    break;
                }
            }
        }
        if (isset($obj->phpdocs) && $obj->phpdocs instanceof tool_behateditor_phpdocs) {
            $boundaries[0] = $obj->phpdocs->get_original_token_id();
        } else {
            // walk back until we meet one of the characters that means that we are outside of the object
            for ($i=$boundaries[0]-1; $i>=0; $i--) {
                $token = $tokens[$i];
                if (in_array($token[0], array(T_OPEN_TAG, T_OPEN_TAG_WITH_ECHO, T_CLOSE_TAG))) {
                    break;
                } else if (in_array($token[1], array('{','}','(',';',',','['))) {
                    break;
                }
            }
            // walk forward to the next meaningful token skipping all spaces and comments
            for ($i=$i+1; $i<$boundaries[0]; $i++) {
                if (!in_array($tokens[$i][0], array(T_WHITESPACE, T_COMMENT, T_DOC_COMMENT))) {
                    break;
                }
            }
            $boundaries[0] = $i;
        }
        return $boundaries;
    }

    /**
     * Checks if the token with id $tid in inside some class
     *
     * @param int $tid
     * @return stdClass|false containing class or false if this is not a member
     */
    public function is_inside_class($tid) {
        $classes = &$this->get_classes();
        $classescnt = count($classes);
        for ($clid = 0; $clid < $classescnt; $clid++) {
            if ($classes[$clid]->boundaries[0] <= $tid && $classes[$clid]->boundaries[1] >= $tid) {
                return $classes[$clid];
            }
        }
        return false;
    }

    /**
     * Checks if the token with id $tid in inside some function or class method
     *
     * @param int $tid
     * @return stdClass|false containing function or false if this is not inside a function
     */
    public function is_inside_function($tid) {
        $functions = &$this->get_functions();
        $functionscnt = count($functions);
        for ($fid = 0; $fid < $functionscnt; $fid++) {
            if ($functions[$fid]->boundaries[0] <= $tid && $functions[$fid]->boundaries[1] >= $tid) {
                return $functions[$fid];
            }
        }
        return false;
    }

    /**
     * Checks if token with id $tid is a whitespace
     *
     * @param int $tid
     * @return boolean
     */
    public function is_whitespace_token($tid) {
        $this->get_tokens();
        return ($this->tokens[$tid][0] == T_WHITESPACE);
    }

    /**
     * Returns how many line feeds are in this token
     *
     * @param int $tid
     * @return int
     */
    public function is_multiline_token($tid) {
        $this->get_tokens();
        return substr_count($this->tokens[$tid][1], "\n");
    }

    /**
     * Returns the first token which is not whitespace following the token with id $tid
     *
     * Also returns false if no meaningful token found till the end of file
     *
     * @param int $tid
     * @param bool $returnid
     * @param array $alsoignore
     * @return int|false
     */
    public function next_nonspace_token($tid, $returnid = false, $alsoignore = array()) {
        $this->get_tokens();
        for ($i=$tid+1; $i<$this->tokenscount; $i++) {
            if (!$this->is_whitespace_token($i) && !in_array($this->tokens[$i][1], $alsoignore)) {
                if ($returnid) {
                    return $i;
                } else {
                    return $this->tokens[$i][1];
                }
            }
        }
        return false;
    }

    /**
     * Returns all modifers (private, public, static, ...) preceeding token with id $tid
     *
     * @param int $tid
     * @return array
     */
    public function find_access_modifiers($tid) {
        $tokens = &$this->get_tokens();
        $modifiers = array();
        for ($i=$tid-1;$i>=0;$i--) {
            if ($this->is_whitespace_token($i)) {
                // skip
            } else if (in_array($tokens[$i][0], array(T_ABSTRACT, T_PRIVATE, T_PUBLIC, T_PROTECTED, T_STATIC, T_VAR, T_FINAL, T_CONST))) {
                $modifiers[] = $tokens[$i][0];
            } else {
                break;
            }
        }
        return $modifiers;
    }

    /**
     * Finds phpdocs preceeding the token with id $tid
     *
     * skips words abstract, private, public, protected and non-multiline whitespaces
     *
     * @param int $tid
     * @return tool_behateditor_phpdocs|false
     */
    public function find_preceeding_phpdoc($tid) {
        $tokens = &$this->get_tokens();
        $modifiers = $this->find_access_modifiers($tid);
        for ($i=$tid-1;$i>=0;$i--) {
            if ($this->is_whitespace_token($i)) {
                if ($this->is_multiline_token($i) == 1) {
                    // one line feed can be between phpdocs and element
                } else if ($this->is_multiline_token($i) > 1) {
                    // more that one line feed means that no phpdocs for this element exists
                    return false;
                } else {
                    // just skip space
                }
            } else if ($tokens[$i][0] == T_DOC_COMMENT) {
                return $this->get_phpdocs($i);
            } else if (in_array($tokens[$i][0], $modifiers)) {
                // just skip
            } else if (in_array($tokens[$i][1], array('{', '}', ';'))) {
                // this means that no phpdocs exists
                return false;
            } else if ($tokens[$i][0] == T_COMMENT) {
                // this probably needed to be doc_comment
                return false;
            } else {
                // no idea what it is!
                // TODO: change to debugging
                //echo "************ Unknown preceeding token id = {$tokens[$i][0]}, text = '{$tokens[$i][1]}' **************<br>";
                return false;
            }
        }
        return false;
    }

    /**
     * Finds the next pair of matching open and close symbols (usually some sort of brackets)
     *
     * @param int $startid id of token where we start looking from
     * @param string $opensymbol opening symbol (, { or [
     * @param string $closesymbol closing symbol ), } or ] respectively
     * @param array $breakifmeet array of symbols that are not allowed not preceed the $opensymbol
     * @return array|false array of ids of two corresponding tokens or false if not found
     */
    public function find_tag_pair($startid, $opensymbol, $closesymbol, $breakifmeet = array()) {
        $openid = false;
        $counter = 0;
        // also break if we find closesymbol before opensymbol
        $breakifmeet[] = $closesymbol;
        for ($i=$startid; $i<$this->tokenscount; $i++) {
            if ($openid === false && in_array($this->tokens[$i][1], $breakifmeet)) {
                return false;
            } else if ($openid !== false && $this->tokens[$i][1] == $closesymbol) {
                $counter--;
                if ($counter == 0) {
                    return array($openid, $i);
                }
            } else if ($this->tokens[$i][1] == $opensymbol) {
                if ($openid === false) {
                    $openid = $i;
                }
                $counter++;
            }
        }
        return false;
    }

    /**
     * Finds the next pair of matching open and close symbols (usually some sort of brackets)
     *
     * @param array $tokens array of tokens to parse
     * @param int $startid id of token where we start looking from
     * @param string $opensymbol opening symbol (, { or [
     * @param string $closesymbol closing symbol ), } or ] respectively
     * @param array $breakifmeet array of symbols that are not allowed not preceed the $opensymbol
     * @return array|false array of ids of two corresponding tokens or false if not found
     */
    public function find_tag_pair_inlist(&$tokens, $startid, $opensymbol, $closesymbol, $breakifmeet = array()) {
        $openid = false;
        $counter = 0;
        // also break if we find closesymbol before opensymbol
        $breakifmeet[] = $closesymbol;
        $tokenscount = count($tokens);
        for ($i=$startid; $i<$tokenscount; $i++) {
            if ($openid === false && in_array($tokens[$i][1], $breakifmeet)) {
                return false;
            } else if ($openid !== false && $tokens[$i][1] == $closesymbol) {
                $counter--;
                if ($counter == 0) {
                    return array($openid, $i);
                }
            } else if ($tokens[$i][1] == $opensymbol) {
                if ($openid === false) {
                    $openid = $i;
                }
                $counter++;
            }
        }
        return false;
    }

    /**
     * Locates the file-level phpdocs and returns it
     *
     * @return string|false either the contents of phpdocs or false if not found
     */
    public function find_file_phpdocs() {
        $tokens = &$this->get_tokens();
        if ($this->filephpdocs === null) {
            $found = false;
            for ($tid=0; $tid<$this->tokenscount; $tid++) {
                if (in_array($tokens[$tid][0], array(T_OPEN_TAG, T_WHITESPACE, T_COMMENT))) {
                    // all allowed before the file-level phpdocs
                } else if ($tokens[$tid][0] == T_DOC_COMMENT) {
                    $found = $tid;
                    break;
                } else {
                    // found something else
                    break;
                }
            }
            if ($found !== false) {
                // Now let's check that this is not phpdocs to the next function or class or define
                $nexttokenid = $this->next_nonspace_token($tid, true);
                if ($nexttokenid === false) {
                    // EOF reached after first phpdoc
                } else {
                    $nexttoken = $this->tokens[$nexttokenid];
                    if ($this->is_whitespace_token($tid+1) && $this->is_multiline_token($tid+1) > 1) {
                        // at least one empty line follows, it's all right
                    } else if (in_array($nexttoken[0], array(T_DOC_COMMENT, T_COMMENT, T_REQUIRE_ONCE, T_REQUIRE, T_IF, T_INCLUDE_ONCE, T_INCLUDE))) {
                        // something non-documentable following, ok
                    } else if ($nexttoken[0] == T_STRING && $nexttoken[1] == 'defined') {
                        // something non-documentable following
                    } else if (in_array($nexttoken[0], array(T_CLASS, T_ABSTRACT, T_INTERFACE, T_FUNCTION))) {
                        // this is the doc comment to the following class/function
                        $found = false;
                    } else {
                        // TODO: change to debugging
                        //echo "************ Unknown token following the first phpdocs in {$this->filepath}: id = {$nexttoken[0]}, text = '{$nexttoken[1]}' **************<br>";
                    }
                }
            }
            $this->filephpdocs = $this->get_phpdocs($found);
        }
        return $this->filephpdocs;
    }

    /**
     * Returns all parsed phpdocs block found in file
     *
     * @return array
     */
    public function &get_all_phpdocs() {
        if ($this->allphpdocs === null) {
            $this->allphpdocs = array();
            $this->get_tokens();
            for ($id=0; $id<$this->tokenscount;$id++) {
                if (($this->tokens[$id][0] == T_DOC_COMMENT || $this->tokens[$id][0] === T_COMMENT)) {
                    $this->allphpdocs[$id] = new tool_behateditor_phpdocs($this->tokens[$id], $id);
                }
            }
        }
        return $this->allphpdocs;
    }

    /**
     * Returns one parsed phpdocs block found in file
     *
     * @param int $tid token id of phpdocs
     * @return tool_behateditor_phpdocs
     */
    public function get_phpdocs($tid) {
        if ($tid === false) {
            return false;
        }
        $this->get_all_phpdocs();
        if (isset($this->allphpdocs[$tid])) {
            return $this->allphpdocs[$tid];
        } else {
            return false;
        }
    }

    /**
     * Given an array of tokens breaks them into chunks by $separator
     *
     * @param array $tokens
     * @param string $separator one-character separator (usually comma)
     * @return array of arrays of tokens
     */
    public function break_tokens_by($tokens, $separator = ',') {
        $rv = array();
        if (!count($tokens)) {
            return $rv;
        }
        $rv[] = array();
        for ($i=0;$i<count($tokens);$i++) {
            if ($tokens[$i][1] == $separator) {
                $rv[] = array();
            } else {
                $nextpair = false;
                if ($tokens[$i][1] == '(') {
                    $nextpair = $this->find_tag_pair_inlist($tokens, $i, '(', ')');
                } else if ($tokens[$i][1] == '[') {
                    $nextpair = $this->find_tag_pair_inlist($tokens, $i, '[', ']');
                } else if ($tokens[$i][1] == '{') {
                    $nextpair = $this->find_tag_pair_inlist($tokens, $i, '{', '}');
                }
                if ($nextpair !== false) {
                    // skip to the end of the tag pair
                    for ($j=$i; $j<=$nextpair[1]; $j++) {
                        $rv[count($rv)-1][] = $tokens[$j];
                    }
                    $i = $nextpair[1];
                } else {
                    $rv[count($rv)-1][] = $tokens[$i];
                }
            }
        }
        // now trim whitespaces
        for ($i=0;$i<count($rv);$i++) {
            if (count($rv[$i]) && $rv[$i][0][0] == T_WHITESPACE) {
                array_shift($rv[$i]);
            }
            if (count($rv[$i]) && $rv[$i][count($rv[$i])-1][0] == T_WHITESPACE) {
                array_pop($rv[$i]);
            }
        }
        return $rv;
    }

    /**
     * Returns line number for the token with specified id
     *
     * @param int $tid id of the token
     */
    public function get_line_number($tid) {
        $tokens = &$this->get_tokens();
        if (count($tokens[$tid])>2) {
            return $tokens[$tid][2];
        } else if ($tid == 0) {
            return 1;
        } else {
            return $this->get_line_number($tid-1) + count(preg_split('/\n/', $tokens[$tid-1][1])) - 1;
        }
    }
}
