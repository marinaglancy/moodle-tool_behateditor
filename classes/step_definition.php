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
 * tool_behateditor_step_definition
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class tool_behateditor_step_definition implements cacheable_object, IteratorAggregate {
    var $component;
    var $stepdescription;
    var $steptype;
    var $stepregex;
    private $hash = null;
    private $keywords = null;

    public function __construct($component, $stepdescription, $steptype, $stepregex) {
        $this->component = $component;
        $this->stepdescription = $stepdescription;
        $this->steptype = $steptype;
        $this->stepregex = trim($stepregex);
    }

    public function get_hash() {
        if ($this->hash === null) {
            $this->hash = sha1($this->component.$this->stepdescription.$this->steptype.$this->stepregex);
        }
        return $this->hash;
    }

    public function get_keywords() {
        if ($this->keywords !== null) {
            return $this->keywords;
        }
        $normalized = preg_replace('/_/', ' ', preg_replace('/^behat_/', '', $this->component));
        $normalized .= ' ' . $this->steptype;
        if (preg_match_all('/"([A-Z][A-Z|0-9|_]*)"/', $this->stepregex, $matches)) {
            foreach ($matches[1] as $match) {
                if (!preg_match('/^SELECTOR[\d]?_STRING$/', $match) && !preg_match('/^TEXT_SELECTOR[\d]?_STRING$/', $match)) {
                    $normalized .= ' '. preg_replace('/_/', ' ', preg_replace(array('/_STRING$/', '/_NUMBER$/'), '', $match));
                }
            }
        }

        $expr = preg_replace('/"[A-Z][A-Z|0-9|_]*"/', ' ', $this->stepregex);
        $normalized .= ' ' . preg_replace('/[\.,!\?;:\-\+\'"\\/\(\)\#|]/', ' ', $this->stepdescription.' '.$expr);
        $keywords = array_unique(preg_split('/\s+/', strtolower($normalized), -1, PREG_SPLIT_NO_EMPTY));
        $keywords = array_filter($keywords, create_function('$a', 'return strlen($a) > 2;'));
        $this->keywords = array_values($keywords);
        return $this->keywords;
    }

    public function has_keyword($needle, $exactmatch = false) {
        if ($exactmatch) {
            return in_array($needle, $this->get_keywords());
        } else {
            $keywords = $this->get_keywords();
            foreach ($keywords as $keyword) {
                if (strpos($keyword, $needle) === 0) {
                    return true;
                }
            }
        }
        return false;
    }

    public function prepare_to_cache() {
        return array(
            'c' => $this->component,
            'd' => $this->stepdescription,
            't' => $this->steptype,
            'r' => $this->stepregex
        );
    }

    public static function wake_from_cache($data) {
        return new self($data['c'], $data['d'], $data['t'], $data['r']);
    }

    public function getIterator() {
        return new ArrayIterator(array(
            'component' => $this->component,
            'stepdescription' => $this->stepdescription,
            'steptype' => $this->steptype,
            'stepregex' => $this->stepregex
        )
        );
    }
}