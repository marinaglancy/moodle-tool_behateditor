<?php

/**
* Extends the navigation for the tool_behateditor plugin
*
* Required to extend the navigation block for this plugin.
* Called from lib/navigationlib.php
*
* @param global_navigation $navigation
*/
function tool_behateditor_extends_navigation(global_navigation $navigation) {
    $baseurl = new moodle_url('/admin/tool/behateditor/index.php');
    $navigation->add(get_string('pluginname', 'tool_behateditor'),
            $baseurl, navigation_node::TYPE_CUSTOM, null, 'tool_behateditor');
}