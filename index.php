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
$PAGE->requires->yui_module('moodle-tool_behateditor-editor', 'M.tool_behateditor.init', array($api->out()), null, true);
echo $OUTPUT->header();

?>
<form action="#" method="POST" id="behateditor_featureedit">
    <div class="featureedit" data-mode="source">
        <div class="topheader">
            <div class="featuretabs">
                <input type="button" class="featuretab" data-mode="editor" value="Feature editor"/>
                <input type="button" class="featuretab iscurrent" data-mode="source" value="Feature source"/>
            </div>
            <div class="fileactions">
                <div class="controls hiddenifjs">
                    <input type="button" data-action="files" value="Feature files">
                    <input type="button" data-action="save" value="Save">
                    <span class="filepath"></span>
                </div>
            </div>
        </div>
            <div class="content content-editor" data-mode="editor"></div>
            <div class="content content-source iscurrent" data-mode="source">
                <textarea id="behateditor_featuresource" name="source" rows="20" cols="60"></textarea>
            </div>
    </div>
</form>
<div style="display:none">
<form action="#" method="POST" id="behateditor_searchform">
    <input name="keyword" type="text" id="behateditor_searchword">
    <div id="behateditor_searchoutput" class="s-definitions"></div>
</form>
<form action="#" method="POST" id="behateditor_fileselectform">
    <div id="behateditor_fileslist" class="featurefileslist"></div>
</form>
<form action="#" method="POST" id="behateditor_filesaveasform">
    <div><input type="text" name="component"/>/tests/behat/<input type="text" name="filename"/>.feature</div>
    <div><input type="button" value="Save"/></div>
</form>
</div>
<?php
echo $OUTPUT->footer();
