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
 * Serving AJAX requests for tool_behateditor
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);

require(__DIR__ . '/../../../config.php');
$PAGE->set_url(new moodle_url('/admin/tool/behateditor/ajax.php'));
$PAGE->set_context(context_system::instance());
//require_capability('moodle/site:config', context_system::instance());
//require_sesskey();

echo $OUTPUT->header();

$action = optional_param('action', null, PARAM_ALPHA);
if ($action == 'search') {
    $keyword = optional_param('keyword', null, PARAM_RAW_TRIMMED);
    $steps = tool_behateditor_helper::search_step_definitions($keyword);
    echo json_encode((object)array('keyword' => $keyword, 'hashes' => array_keys($steps)));
} else if ($action == 'stepsdef') {
    require_once($CFG->libdir . '/behat/classes/behat_selectors.php');
    $force = optional_param('force', false, PARAM_BOOL);
    $steps = tool_behateditor_helper::get_step_definitions($force);
    echo json_encode((object)array(
        'stepsdefinitions' => convert_to_array($steps),
        'textselectors' => behat_selectors::get_allowed_text_selectors(),
        'selectors' => behat_selectors::get_allowed_selectors(),
    ));
} else {
    echo json_encode((object)array('error' => 'Unknown command: '. $action));
}
echo $OUTPUT->footer();