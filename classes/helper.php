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
 * tool_behateditor_helper
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * tool_behateditor_helper
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class tool_behateditor_helper {

    /** @var tool_behateditor_step_definition[] */
    static private $stepdefinitions = null;

    /** @var tool_behateditor_step_function[] */
    static private $stepfunctions = null;

    /**
     *
     * @return array
     */
    public static function get_componenets() {
        global $CFG;
        require_once($CFG->libdir . '/behat/classes/behat_config_manager.php');
        return behat_config_manager::get_components_steps_definitions();
    }

    /**
     *
     * @return tool_behateditor_step_definition[]
     */
    public static function get_step_definitions($forceretrieve = false) {
        if (!$forceretrieve && self::$stepdefinitions !== null) {
            return self::$stepdefinitions;
        }
        $cache = cache::make('tool_behateditor', 'stepdef');
        if ($forceretrieve) {
            $cache->purge();
        }
        self::$stepdefinitions = array();
        if (!$forceretrieve && ($steps = $cache->get('steps')) !== false) {
            foreach ($steps as $step) {
                self::$stepdefinitions[$step->get_hash()] = $step;
            }
        } else {
            $components = self::get_componenets();
            foreach ($components as $component => $path) {
                self::$stepdefinitions += self::get_step_definitions_for_component($component);
            }
            $cache->set('steps', new cacheable_object_array(array_values(self::$stepdefinitions)));
        }
        return self::$stepdefinitions;
    }

    /**
     *
     * @return tool_behateditor_step_definition[]
     */
    protected static function get_step_definitions_for_component($component) {
        global $CFG;
        require_once($CFG->libdir . '/behat/classes/behat_config_manager.php');
        behat_config_manager::update_config_file($component, false);
        $options = ' --config="'.behat_config_manager::get_steps_list_config_filepath(). '" -di';
        list($content, $exitcode) = behat_command::run($options);
        $content = join('', $content);
        $regex = '|<div class="step"><div class="stepdescription">(.*?)</div><div class="stepcontent"><span class="steptype">(.*?)</span><span class="stepregex">(.*?)</span></div></div>|';
        preg_match_all($regex, $content, $matches);
        $steps = array();
        foreach ($matches[0] as $i => $expression) {
            $step = new tool_behateditor_step_definition($component, $matches[1][$i], $matches[2][$i], $matches[3][$i]);
            $steps[$step->get_hash()] = $step;
        }
        return $steps;
    }

    /**
     *
     * @return string[]
     */
    /*public static function get_keywords() {
        $cache = cache::make('tool_behateditor', 'stepdef');
        if (($keywords = $cache->get('keywords')) !== false) {
            return $keywords;
        }
        $keywords = array();
        $steps = self::get_step_definitions();
        foreach ($steps as $step) {
            $keywords = array_merge($keywords, $step->get_keywords());
        }
        $keywords = array_unique($keywords);
        sort($keywords, SORT_STRING);
        $cache->set('keywords', $keywords);
        return $keywords;
    }*/

    /**
     *
     * @return tool_behateditor_step_definition[]
     */
    /*public static function search_step_definitions($searchstring) {
        $searchstring = trim(strtolower($searchstring));
        if (empty($searchstring)) {
            return self::get_step_definitions();
        }
        $words = preg_split('/ /', $searchstring, -1, PREG_SPLIT_NO_EMPTY);
        $hashes1 = self::get_step_hashes_with_keyword(array_shift($words));
        $steps1 = array_intersect_key(self::get_step_definitions(), $hashes1);
        if (!count($words)) {
            return $steps1;
        }
        $steps = array();
        foreach ($steps1 as $hash => $step) {
            foreach ($words as $word) {
                if (!$step->has_keyword($word)) {
                    continue 2;
                }
            }
            $steps[$hash] = $step;
        }
        return $steps;
    }*/

    /**
     *
     * @return array where both key and value is the step definition hash
     */
    /*protected static function get_step_hashes_with_keyword($keyword, $exactmatch = false) {
        $allkeywords = self::get_keywords();
        if ($exactmatch) {
            if (!in_array($keyword, $allkeywords)) {
                return array();
            }
            $cache = cache::make('tool_behateditor', 'stepdef');
            if (($hashes = $cache->get('keyword:'. $keyword)) === false) {
                $hashes = array();
                $allsteps = self::get_step_definitions();
                foreach ($allsteps as $hash => $step) {
                    if ($step->has_keyword($keyword, $exactmatch)) {
                        $hashes[] = $hash;
                    }
                }
                $cache->set('keyword:'. $keyword, $hashes);
            }
            return array_combine($hashes, $hashes);
        }

        $hashes = array();
        foreach ($allkeywords as $word) {
            if (strpos($word, $keyword) === 0) {
                $hashes += self::get_step_hashes_with_keyword($word, true);
            }
        }
        return $hashes;
    }*/

    public static function get_feature_files($force = false) {
        global $CFG;
        require_once($CFG->libdir . '/testing/classes/tests_finder.php');
        $componentpaths = tests_finder::get_components_with_tests('features');
        asort($componentpaths);

        $featurefiles = array();
        foreach ($componentpaths as $component => $path) {
            $files = array_filter(get_directory_list($path),
                    create_function('$a', 'return pathinfo($a, PATHINFO_EXTENSION) == "feature";'));
            sort($files);
            foreach ($files as $filepath) {
                $feature = new tool_behateditor_feature($component, $path, $filepath);
                if (!isset($featurefiles[$feature->get_hash()])) {
                    $featurefiles[$feature->get_hash()] = $feature;
                }
            }
        }
        return $featurefiles;
    }

    /**
     *
     * @param bool $force if true cache will not be used
     * @return tool_behateditor_step_function[]
     */
    public static function get_step_functions($forceretrieve = false) {
        //if (!$forceretrieve && self::$stepfunctions !== null) {
        //    return self::$stepfunctions;
        //}
        $cache = cache::make('tool_behateditor', 'stepdef');
        if ($forceretrieve) {
            $cache->purge();
        }
        self::$stepfunctions = array();
        if (!$forceretrieve && ($steps = $cache->get('stepfunctions')) !== false) {
            foreach ($steps as $step) {
                self::$stepfunctions[$step->get_hash()] = $step;
            }
        } else {
            $components = self::get_componenets();
            foreach ($components as $componentname => $path) {
                $file = new tool_behateditor_file($path);
                foreach ($file->get_functions() as $function) {
                    try {
                        $f = new tool_behateditor_step_function($componentname, $path, $function, $file);
                    } catch (coding_exception $e) {
                        continue;
                    }
                    self::$stepfunctions[$f->get_hash()] = $f;
                }
            }
            $cache->set('stepfunctions', new cacheable_object_array(array_values(self::$stepfunctions)));
        }
        return self::$stepfunctions;
    }
}