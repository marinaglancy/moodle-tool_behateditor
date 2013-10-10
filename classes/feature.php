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
 * tool_behateditor_feature
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * tool_behateditor_feature
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class tool_behateditor_feature implements cacheable_object, IteratorAggregate {
    var $component;
    var $filepath;
    private $hash = null;

    public function __construct($component, $path, $subpath = null) {
        global $CFG;
        $this->component = $component;
        if (empty($subpath)) {
            $this->filepath = $path;
        } else {
            $this->filepath = rtrim($path, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.$subpath;
        }
        $prefix = $CFG->dirroot.DIRECTORY_SEPARATOR;
        if (strpos($this->filepath, $prefix) === 0) {
            $this->filepath = substr($this->filepath, strlen($prefix));
        }
    }

    public function get_hash() {
        if ($this->hash === null) {
            $this->hash = sha1($this->filepath);
        }
        return $this->hash;
    }

    public function prepare_to_cache() {
        return array(
            'c' => $this->component,
            'f' => $this->filepath,
        );
    }

    public static function wake_from_cache($data) {
        return new self($data['c'], $data['f']);
    }

    public function getIterator() {
        return new ArrayIterator(array(
            'component' => $this->component,
            'filepath' => $this->filepath,
        )
        );
    }
}