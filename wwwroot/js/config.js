(function (window) {

    'use strict';

    /**
     * Runtime configuration / "env" for frontend scripts.
     *
     * Central place to define API base URLs so they are not hardcoded
     * in each JS file. When deploying to another server, update only
     * this file (or override via server-side templating).
     */

    var origin = window.location.origin || '';

    var API_BASE = origin + '/database/api.php';
    var ADMIN_API_BASE = origin + '/database/admin_api.php';

    window.APP_CONFIG = Object.freeze({
        API_BASE_URL: API_BASE,
        ADMIN_API_BASE_URL: ADMIN_API_BASE
    });

    window.API_BASE_URL = API_BASE;
    window.ADMIN_API_BASE_URL = ADMIN_API_BASE;

})(window);
