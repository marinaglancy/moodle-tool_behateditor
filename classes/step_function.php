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
 * tool_behateditor_step_definition
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Step definition as a result of parsing function sourcecode
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class tool_behateditor_step_function implements cacheable_object, IteratorAggregate {
    var $component;
    var $fullpath;
    var $path;
    var $function;
    var $lines;
    var $steptype;
    var $fullregex;
    var $stepdescription;
    var $steptext;
    var $params;
    var $functionname;
    var $multiline = false;
    private $hash = null;
    private $keywords = null;

    /**
     *
     * @param string $component
     * @param string $path
     * @param stdClass $function as returned from {@link tool_behateditor_file::get_functions()}
     * @param tool_behateditor_file $file
     * @throws coding_exception
     */
    public function __construct($component, $path, $function, $file) {
        global $CFG;
        $this->component = $component;
        $this->fullpath = $path;
        $this->function = $function;

        if ($file) {
            // Creating from proper function and file objects.
            if (empty($function->class->name) ||
                            array_intersect($function->accessmodifiers, array(T_ABSTRACT, T_PRIVATE, T_PROTECTED))) {
                throw new coding_exception('Function is not a behat step definition');
            }
            $regex = array_filter(array(
                'Given' => $function->phpdocs->get_tags('Given'),
                'When' => $function->phpdocs->get_tags('When'),
                'Then' => $function->phpdocs->get_tags('Then'),
                'And' => $function->phpdocs->get_tags('And')
            ));
            if (!$regex) {
                throw new coding_exception('Function is not a behat step definition');
            }
            $this->steptype = key($regex);
            $this->lines = array(
                $file->get_line_number($function->boundaries[0]),
                $file->get_line_number($function->boundaries[1])
            );
            $this->fullregex = $regex[$this->steptype][0];
            $this->stepdescription = $function->phpdocs->get_description();
            $this->functionname = $function->fullname;

            $this->parse_full_regex();
        } else {
            // Restoring from cache, $function already stores all info.
            $this->lines = $function->lines;
            $this->steptype = $function->steptype;
            $this->fullregex = $function->fullregex;
            $this->steptext = $function->steptext;
            $this->params = $function->params;
            $this->multiline = $function->multiline;
            $this->stepdescription = $function->stepdescription;
            $this->functionname = $function->functionname;
        }


        $prefix = $CFG->dirroot.DIRECTORY_SEPARATOR;
        if (strpos($this->fullpath, $prefix) === 0) {
            $this->path = substr($this->fullpath, strlen($prefix));
        } else {
            $this->path = $this->fullpath;
        }
    }

    public function get_hash() {
        if ($this->hash === null) {
            // TODO
            $this->hash = sha1($this->path.$this->functionname);
        }
        return $this->hash;
    }

    public function get_keywords() {
        if ($this->keywords !== null) {
            return $this->keywords;
        }
        $normalized = preg_replace('/_/', ' ', preg_replace('/^behat_/', '', $this->component));
        $normalized .= ' ' . $this->steptype;
        $stepregex = preg_replace('|<\/?span>|', '', $this->steptext);
        if (preg_match_all('/"([A-Z][A-Z|0-9|_]*)"/', $stepregex, $matches)) {
            foreach ($matches[1] as $match) {
                if (!preg_match('/^SELECTOR[\d]?_STRING$/', $match) && !preg_match('/^TEXT_SELECTOR[\d]?_STRING$/', $match)) {
                    $normalized .= ' '. preg_replace('/_/', ' ', preg_replace(array('/_STRING$/', '/_NUMBER$/'), '', $match));
                }
            }
        }

        $expr = preg_replace('/"[A-Z][A-Z|0-9|_]*"/', ' ', $stepregex);
        $normalized .= ' ' . preg_replace('/[\.,!\?;:\-\+\'"\\/\(\)\#\=|]/', ' ', $this->stepdescription.' '.$expr);
        $keywords = array_unique(preg_split('/\s+/', strtolower($normalized), -1, PREG_SPLIT_NO_EMPTY));
        sort($keywords);
        $this->keywords = array_values($keywords);
        return $this->keywords;
    }

    protected function parse_full_regex() {
        // Create a mask by removing all parenthesis that are not parameters.
        $mask = $this->fullregex;
        while (true) {
            $b = preg_replace_callback('/\([^\)\(]+\)/',
                    create_function('$a', 'if (preg_match("/^\(\?P/", $a[0])) { return $a[0]; } else { return str_repeat("-", strlen($a[0])); }'),
                    $mask);
            if ($b === $mask) {
                break;
            }
            $mask = $b;
        }

        // Split the mask string by parenthesis, use the maskchunk's lengths to cut the text into chunks.
        // Chunks with indexes 0,2,4,... are texts, 1,3,5,... are parameters regexps.
        $maskchunks = preg_split('/[\)\(]/', $mask);
        $this->steptext = '';
        $this->params = array();
        $regex = '';
        $pos = 0;
        foreach ($maskchunks as $i => $maskchunk) {
            $chunk = substr($this->fullregex, $pos, strlen($maskchunk));
            if ($i%2 == 0) {
                // This is part of text.
                $this->steptext .= $chunk;
                $regex .= $chunk;
            } else {
                // This is a parameter.
                $p = $this->prepare_param($chunk, ($i+1)/2);
                $this->steptext .= html_writer::tag('span', '', $p);
                $regex .= '('.$p['data-regex'].')';
                $this->params[] = $p;
            }
            $pos += strlen($maskchunk) + 1;
        }
        //$this->steptext = preg_replace(array('|^\/|','|\/$|'), '', $this->steptext);
        //$this->fullregex = $regex;

        $this->prepare_additional_params();
    }

    protected function prepare_param($chunk, $idx) {
        global $CFG;
        if (preg_match('/^\?P\<([^\>]*)\>(.*)$/', $chunk, $matches)) {
            $regex = $matches[2];
            $name = strtoupper($matches[1]);
        } else {
            $regex = preg_replace('/^\?P/', '', $chunk);
            $name = 'PARAM'.  $idx;
        }
        $p = array(
            'data-regex' => $regex,
            'data-name' => $name
        );
        if (in_array($regex, array('\d+','\d*','[\d]+','[\d]*'))) {
            $p['data-type'] = 'NUMBER';
        } else if (preg_match('/^SELECTOR\d?_STRING$/', $name)) {
            require_once($CFG->libdir . '/behat/classes/behat_selectors.php');
            $p['data-type'] = 'SELECT';
            $p['data-options'] = array_values(behat_selectors::get_allowed_selectors());
        } else if (preg_match('/^TEXT_SELECTOR\d?_STRING$/', $name)) {
            require_once($CFG->libdir . '/behat/classes/behat_selectors.php');
            $p['data-type'] = 'SELECT';
            $p['data-options'] = array_values(behat_selectors::get_allowed_text_selectors());
        } else if (preg_match('/^([\w]+\|)+[\w]+$/', $regex)) {
            $p['data-type'] = 'SELECT';
            $p['data-options'] = preg_split('/\|/', $regex);
        } else {
            $p['data-type'] = 'STRING';
        }

        if ($p['data-type'] == 'NUMBER') {
            $p['data-default'] = 1;
        } else if ($p['data-type'] == 'SELECT') {
            $p['data-default'] = $p['data-options'][0];
        } else {
            $p['data-default'] = $name;
            // TODO maybe make sure parameter name matches it's own regex?
        }
        if (!empty($p['data-options'])) {
            $p['data-options'] = join(',', $p['data-options']);
        }
        return $p;
    }

    protected function prepare_additional_params() {
        $phpdocparams = $this->function->phpdocs->get_params();
        $cnt = count($this->params);
        for ($i = $cnt; $i<count($this->function->arguments); $i++) {
            $name = !empty($this->function->arguments[$i][1]) ?
                    $this->function->arguments[$i][1] :
                    (!empty($phpdocparams[$i][1]) ? $phpdocparams[$i][1] : 'PARAM'.  $i);
            $this->params[] = array(
                'data-regex' => '',
                'data-name' => strtoupper(preg_replace('/^\$/', '', $name)),
                'data-type' => !empty($this->function->arguments[$i][0]) ?
                    $this->function->arguments[$i][0] :
                    (!empty($phpdocparams[$i][0]) ? $phpdocparams[$i][0] : ''),
                'data-default' => '  |  |  |' // TODO!

            );
            $this->multiline = true;
        }
    }

    public function prepare_to_cache() {
        return array(
            'c' => $this->component,
            'p' => $this->fullpath,
            'f' => (object)array(
                'functionname' => $this->functionname,
                'lines' => $this->lines,
                'stepdescription' => $this->stepdescription,
                'steptype' => $this->steptype,
                'fullregex' => $this->fullregex,
                'steptext' => $this->steptext,
                'params' => $this->params,
                'multiline' => $this->multiline,
            )
        );
    }

    public static function wake_from_cache($data) {
        return new self($data['c'], $data['p'], $data['f'], null);
    }

    public function getIterator() {
        return new ArrayIterator(array(
            'component' => $this->component,
            'functionname' => $this->functionname,
            'path' => $this->path,
            'lines' => $this->lines,
            'stepdescription' => $this->stepdescription,
            'steptype' => $this->steptype,
            //'fullregex' => $this->fullregex,
            'steptext' => $this->steptext,
            //'params' => $this->params,
            'multiline' => $this->multiline,
            'keywords' => $this->get_keywords(),
        )
        );
    }
}