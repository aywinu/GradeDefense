<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {
    $settings->add(new admin_setting_configtext(
        'block_gradedefense/gameurl',
        get_string('gameurl', 'block_gradedefense'),
        get_string('gameurl_desc', 'block_gradedefense'),
        'https://aywinu.github.io/GradeDefense/',
        PARAM_URL
    ));
}
