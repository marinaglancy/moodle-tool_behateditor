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
 * tool_behateditor
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../../config.php');
require_once($CFG->libdir.'/adminlib.php');
require_once($CFG->libdir . '/behat/classes/behat_config_manager.php');

//admin_externalpage_setup('toolbehateditor');
$PAGE->set_url(new moodle_url('/admin/tool/behateditor/index.php'));
$PAGE->set_context(context_system::instance());
$PAGE->set_pagelayout('admin');

$api = new moodle_url('/admin/tool/behateditor/ajax.php');
$PAGE->requires->js_init_call('M.tool_behateditor.init', array($api->out()), true);
echo $OUTPUT->header();

?>
<form action="#" method="POST" id="behateditor_featureedit">
    <div class="featureedit mode-source">
        <div class="featuretabs">
            <div class="featuretab tab-editor">Feature editor</div>
            <div class="featuretab tab-source">Feature source</div>
        </div>
        <div class="content">
            <div class="content-editor"></div>
            <div class="content-source">
                <textarea id="behateditor_featuresource" name="source" rows="20" cols="60"></textarea>
            </div>
        </div>
    </div>
</form>
<form action="#" method="POST" id="behateditor_searchform" class="hiddenifjs">
    <input name="keyword" type="text" id="behateditor_searchword">
    <div id="behateditor_searchoutput" class="s-definitions"></div>
</form>
<?php
echo $OUTPUT->footer();
