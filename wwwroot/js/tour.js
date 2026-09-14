/**
 * LEAVE RMS - Platform Tour System
 * 
 * Provides an interactive tour of the main platform features including
 * notifications, platform access, and user settings.
 * 
 * @author System Administrator
 * @version 1.0
 */

class PlatformTour {
    constructor() {
        this.currentStep = 0;
        this.tourSteps = [];
        this.isActive = false;
        this.overlay = null;
        this.tooltip = null;
        this.init();
    }

    init() {
        this.createTourSteps();
        this.createOverlay();
        this.createTooltip();
        this.checkIfFirstTimeUser();
    }

    /**
     * Checks if this is the user's first time and should show the tour
     */
    checkIfFirstTimeUser() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && user.username) {
            const hasSeenTour = localStorage.getItem(`tour_seen_${user.id || user.username}`) || localStorage.getItem(`tour_completed_${user.username}`);
            if (!hasSeenTour) {
                // Wait for the page to fully load and translations to be available
                setTimeout(() => {
                    console.log('Starting tour, checking translations...');
                    console.log('Window translations:', window.translations);
                    if (window.translations) {
                        this.startTour();
                    } else {
                        // If translations aren't ready yet, wait a bit more
                        setTimeout(() => {
                            console.log('Retrying tour start...');
                            this.startTour();
                        }, 500);
                    }
                }, 1500);
            }
        }
    }

    /**
     * Creates the tour steps with translations
     */
    createTourSteps() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const role = (user && user.role) ? String(user.role).toLowerCase().trim() : 'instructor';

        if (role === 'student') {
            // Student-specific tour: no notifications, focused on platforms, dining, announcements, settings
            this.tourSteps = [
                {
                    target: '#platforms-section',
                    titleKey: 'tour-platforms-title',
                    contentKey: 'tour-platforms-content',
                    position: 'right'
                },
                {
                    target: '#dining-menu-section',
                    titleKey: 'tour-dining-menu-title',
                    contentKey: 'tour-dining-menu-content',
                    position: 'left'
                },
                {
                    target: '#announcements-section',
                    titleKey: 'tour-announcements-title',
                    contentKey: 'tour-announcements-content',
                    position: 'left'
                },
                {
                    target: '#user-dropdown-btn',
                    titleKey: 'tour-settings-title',
                    contentKey: 'tour-settings-content',
                    position: 'bottom'
                },
                {
                    target: 'header h1',
                    titleKey: 'tour-navigation-title',
                    contentKey: 'tour-navigation-content',
                    position: 'bottom'
                },
                {
                    target: '#username',
                    titleKey: 'tour-welcome-title',
                    contentKey: 'tour-welcome-content',
                    position: 'bottom'
                }
            ];
            // Extra safety: remove any step that references notifications if present
            this.tourSteps = this.tourSteps.filter(step =>
                typeof step.target === 'string' && !step.target.includes('notification')
            );
        } else {
            // Default tour (instructors/admins)
            this.tourSteps = [
                {
                    target: '#notification-btn',
                    titleKey: 'tour-notifications-title',
                    contentKey: 'tour-notifications-content',
                    position: 'bottom'
                },
                {
                    target: '#platforms-section',
                    titleKey: 'tour-platforms-title',
                    contentKey: 'tour-platforms-content',
                    position: 'right'
                },
                {
                    target: '#dining-menu-section',
                    titleKey: 'tour-dining-menu-title',
                    contentKey: 'tour-dining-menu-content',
                    position: 'left'
                },
                {
                    target: '#announcements-section',
                    titleKey: 'tour-announcements-title',
                    contentKey: 'tour-announcements-content',
                    position: 'left'
                },
                {
                    target: '#user-dropdown-btn',
                    titleKey: 'tour-settings-title',
                    contentKey: 'tour-settings-content',
                    position: 'bottom'
                },
                {
                    target: 'header h1',
                    titleKey: 'tour-navigation-title',
                    contentKey: 'tour-navigation-content',
                    position: 'bottom'
                },
                {
                    target: '#username',
                    titleKey: 'tour-welcome-title',
                    contentKey: 'tour-welcome-content',
                    position: 'bottom'
                }
            ];
        }

        // Final guard: remove any steps whose targets are not visible right now
        this.tourSteps = this.tourSteps.filter(step => {
            const el = document.querySelector(step.target);
            return el && this.isElementVisible(el);
        });
    }

    /**
     * Creates the tour overlay
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'tour-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9998;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;
        document.body.appendChild(this.overlay);
    }

    /**
     * Creates the tour tooltip
     */
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'tour-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            padding: 20px;
            max-width: 300px;
            z-index: 10000;
            opacity: 0;
            transform: scale(0.9);
            transition: all 0.3s ease;
            pointer-events: none;
        `;
        document.body.appendChild(this.tooltip);
    }

    /**
     * Starts the tour
     */
    startTour() {
        if (this.isActive) return;
        // Recompute steps at start to ensure role-aware steps are applied
        this.createTourSteps();
        this.isActive = true;
        const activeUser = JSON.parse(localStorage.getItem('user') || 'null');
        if (activeUser && activeUser.username) {
            localStorage.setItem(`tour_seen_${activeUser.id || activeUser.username}`, 'true');
            localStorage.setItem(`tour_completed_${activeUser.username}`, 'true');
        }
        this.currentStep = 0;
        this.showOverlay();
        this.showStep(0);
        
        // Add escape key listener
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    /**
     * Shows the tour overlay
     */
    showOverlay() {
        this.overlay.style.opacity = '1';
        this.overlay.style.pointerEvents = 'auto';
    }

    /**
     * Hides the tour overlay
     */
    hideOverlay() {
        this.overlay.style.opacity = '0';
        this.overlay.style.pointerEvents = 'none';
    }

    /**
     * Shows a specific tour step
     * @param {number} stepIndex - Index of the step to show
     */
    showStep(stepIndex) {
        if (stepIndex >= this.tourSteps.length) {
            this.endTour();
            return;
        }

        const step = this.tourSteps[stepIndex];
        // Defensive skip for notification steps when role is student
        const userForStep = JSON.parse(localStorage.getItem('user') || 'null');
        const roleForStep = (userForStep && userForStep.role) ? String(userForStep.role).toLowerCase().trim() : 'instructor';
        if (roleForStep === 'student') {
            const titleMaybe = this.getTranslation(step.titleKey) || '';
            const contentMaybe = this.getTranslation(step.contentKey) || '';
            const mentionsNotification = /notification/i.test(titleMaybe) || /notification/i.test(contentMaybe);
            if (
                mentionsNotification ||
                (typeof step.target === 'string' && step.target.toLowerCase().includes('notification'))
            ) {
                this.showStep(stepIndex + 1);
                return;
            }
        }
        const targetElement = document.querySelector(step.target);
        
        if (!targetElement || !this.isElementVisible(targetElement)) {
            this.showStep(stepIndex + 1);
            return;
        }

        this.highlightElement(targetElement);
        this.showTooltip(targetElement, step);
    }

    /**
     * Highlights the target element
     * @param {HTMLElement} element - Element to highlight
     */
    highlightElement(element) {
        // Remove previous highlights
        document.querySelectorAll('.tour-highlight').forEach(el => {
            el.classList.remove('tour-highlight');
            // Restore original styles instead of clearing them
            if (el.dataset.originalBoxShadow !== undefined) {
                el.style.boxShadow = el.dataset.originalBoxShadow;
                delete el.dataset.originalBoxShadow;
            } else {
                el.style.boxShadow = '';
            }
            if (el.dataset.originalBackground !== undefined) {
                el.style.background = el.dataset.originalBackground;
                delete el.dataset.originalBackground;
            } else {
                el.style.background = '';
            }
        });

        // Store original styles before highlighting
        if (!element.dataset.originalBoxShadow) {
            element.dataset.originalBoxShadow = element.style.boxShadow || '';
        }
        if (!element.dataset.originalBackground) {
            element.dataset.originalBackground = element.style.background || '';
        }

        // Add highlight to current element
        element.classList.add('tour-highlight');
        // Don't add inline styles - let CSS handle the styling
    }

    /**
     * Shows the tooltip for the current step
     * @param {HTMLElement} targetElement - Target element
     * @param {Object} step - Tour step data
     */
    showTooltip(targetElement, step) {
        const rect = targetElement.getBoundingClientRect();
        const isDark = document.body.classList.contains('dark-mode');
        
        console.log('Showing tooltip for step:', step);
        console.log('Title key:', step.titleKey);
        console.log('Content key:', step.contentKey);
        
        const title = this.getTranslation(step.titleKey);
        const content = this.getTranslation(step.contentKey);
        const titleColor = isDark ? '#f0f0f0' : '#000000';
        const textColor = isDark ? '#ccc' : '#666';
        
        console.log('Translated title:', title);
        console.log('Translated content:', content);
        
        const tooltipContent = `
            <div style="margin-bottom: 15px;">
                <h3 style="margin: 0 0 10px 0; color: ${titleColor}; font-size: 16px; font-weight: bold;">${title}</h3>
                <p style="margin: 0; color: ${textColor}; line-height: 1.5; font-size: 14px;">${content}</p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: ${textColor};">${this.currentStep + 1} of ${this.tourSteps.length}</span>
                <div style="display: flex; gap: 8px;">
                    <button id="tour-skip" class="tour-btn tour-btn-secondary" style="font-size: 12px; padding: 6px 12px;">${this.getTranslation('tour-skip')}</button>
                    <button id="tour-prev" class="tour-btn tour-btn-secondary" style="display: ${this.currentStep === 0 ? 'none' : 'inline-block'};">${this.getTranslation('tour-previous')}</button>
                    <button id="tour-next" class="tour-btn tour-btn-primary">${this.currentStep === this.tourSteps.length - 1 ? this.getTranslation('tour-finish') : this.getTranslation('tour-next')}</button>
                </div>
            </div>
        `;

        this.tooltip.innerHTML = tooltipContent;
        this.tooltip.style.opacity = '1';
        this.tooltip.style.transform = 'scale(1)';
        this.tooltip.style.pointerEvents = 'auto';
        // Apply theme to tooltip container
        this.tooltip.style.background = isDark ? '#060e1e' : 'white';
        this.tooltip.style.boxShadow = isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.15)';

        // Position tooltip
        this.positionTooltip(targetElement, step.position);

        // Add event listeners
        this.addTooltipEventListeners();
    }

    /**
     * Determines if an element is visible (not hidden and displayed)
     * @param {HTMLElement} el - Element to check
     * @returns {boolean} true if visible
     */
    isElementVisible(el) {
        if (!el) return false;
        // Skip if element or any parent has class 'hidden'
        let node = el;
        while (node) {
            if (node.classList && node.classList.contains('hidden')) {
                return false;
            }
            node = node.parentElement;
        }
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
        const rects = el.getClientRects();
        if (!rects || rects.length === 0) return false;
        if ((el.offsetWidth <= 0 && el.offsetHeight <= 0)) return false;
        return true;
    }

    /**
     * Positions the tooltip relative to the target element
     * @param {HTMLElement} targetElement - Target element
     * @param {string} position - Preferred position
     */
    positionTooltip(targetElement, position) {
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const padding = 20;

        let left, top;

        switch (position) {
            case 'left':
                left = rect.left - tooltipRect.width - padding;
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                break;
            case 'right':
                left = rect.right + padding;
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                break;
            case 'top':
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                top = rect.top - tooltipRect.height - padding;
                break;
            case 'bottom':
            default:
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                top = rect.bottom + padding;
                break;
        }

        // Ensure tooltip stays within viewport
        if (left < padding) left = padding;
        if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }
        if (top < padding) top = padding;
        if (top + tooltipRect.height > window.innerHeight - padding) {
            top = window.innerHeight - tooltipRect.height - padding;
        }

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }

    /**
     * Adds event listeners to tooltip buttons
     */
    addTooltipEventListeners() {
        const prevBtn = document.getElementById('tour-prev');
        const nextBtn = document.getElementById('tour-next');
        const skipBtn = document.getElementById('tour-skip');

        if (prevBtn) {
            prevBtn.onclick = () => this.previousStep();
        }

        if (nextBtn) {
            nextBtn.onclick = () => this.nextStep();
        }

        if (skipBtn) {
            skipBtn.onclick = () => this.endTour();
        }
    }

    /**
     * Goes to the previous step
     */
    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }

    /**
     * Goes to the next step
     */
    nextStep() {
        if (this.currentStep < this.tourSteps.length - 1) {
            this.currentStep++;
            this.showStep(this.currentStep);
        } else {
            this.endTour();
        }
    }

    /**
     * Handles keyboard navigation
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeydown(event) {
        if (!this.isActive) return;

        switch (event.key) {
            case 'Escape':
                this.endTour();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.previousStep();
                break;
            case 'ArrowRight':
            case 'Enter':
                event.preventDefault();
                this.nextStep();
                break;
        }
    }

    /**
     * Ends the tour
     */
    endTour() {
        this.isActive = false;
        this.hideOverlay();
        this.hideTooltip();
        this.removeHighlights();
        
        // Mark tour as completed for this user
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && user.username) {
            localStorage.setItem(`tour_seen_${user.id || user.username}`, 'true');
            localStorage.setItem(`tour_completed_${user.username}`, 'true');
        }

        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeydown.bind(this));
        
        // Ensure notifications are properly displayed after tour ends
        setTimeout(() => {
            if (window.loadNotifications && typeof window.loadNotifications === 'function') {
                window.loadNotifications();
            }
        }, 100);
    }

    /**
     * Hides the tooltip
     */
    hideTooltip() {
        this.tooltip.style.opacity = '0';
        this.tooltip.style.transform = 'scale(0.9)';
        this.tooltip.style.pointerEvents = 'none';
    }

    /**
     * Removes all tour highlights
     */
    removeHighlights() {
        document.querySelectorAll('.tour-highlight').forEach(el => {
            el.classList.remove('tour-highlight');
            // Restore original styles instead of clearing them
            if (el.dataset.originalBoxShadow !== undefined) {
                el.style.boxShadow = el.dataset.originalBoxShadow;
                delete el.dataset.originalBoxShadow;
            } else {
                el.style.boxShadow = '';
            }
            if (el.dataset.originalBackground !== undefined) {
                el.style.background = el.dataset.originalBackground;
                delete el.dataset.originalBackground;
            } else {
                el.style.background = '';
            }
        });
    }

    /**
     * Restarts the tour (for manual restart)
     */
    restartTour() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && user.username) {
            localStorage.removeItem(`tour_seen_${user.id || user.username}`);
            localStorage.removeItem(`tour_completed_${user.username}`);
        }
        this.startTour();
    }

    /**
     * Gets translation for a given key
     * @param {string} key - Translation key
     * @returns {string} Translated text or key if translation not found
     */
    getTranslation(key) {
        const currentLang = localStorage.getItem('language') || 'en';
        
        console.log('Getting translation for key:', key, 'in language:', currentLang);
        console.log('Available translations:', window.translations);
        
        // Fallback translations in case the main translations aren't loaded
        const fallbackTranslations = {
            'en': {
                'tour-notifications-title': 'Notifications Center',
                'tour-notifications-content': 'Click the bell icon to view your notifications from all connected platforms including RMS, Leave Portal, SIS, and LMS.',
                'tour-platforms-title': 'Platform Access',
                'tour-platforms-content': 'This is where you can access all your university platforms. Click on any platform card to open it in a new tab.',
                'tour-dining-menu-title': 'Dining Menu',
                'tour-dining-menu-content': 'Check today\'s dining menu and meal schedules. Click on the card to view full details including breakfast and lunch times.',
                'tour-announcements-title': 'Announcements',
                'tour-announcements-content': 'Stay updated with the latest announcements from administrators. Click on any announcement to read the full details.',
                'tour-settings-title': 'User Settings',
                'tour-settings-content': 'Click here to access your account settings, change language, toggle dark mode, or log out.',
                'tour-navigation-title': 'Platform Navigation',
                'tour-navigation-content': 'This is your central hub for accessing all university systems. You can always return here to switch between platforms.',
                'tour-welcome-title': 'Welcome Message',
                'tour-welcome-content': 'You\'re all set! Your username is displayed here. You can now explore all the platforms and features available to you.',
                'tour-previous': 'Previous',
                'tour-next': 'Next',
                'tour-finish': 'Finish',
                'tour-restart': 'Restart Tour',
                'tour-skip': 'Skip'
            }
        };
        
        if (window.translations && window.translations[currentLang]) {
            const translation = window.translations[currentLang][key];
            
            if (translation) {
                console.log('Found translation:', translation);
                return translation;
            } else {
                console.log('No translation found for key:', key, 'in language:', currentLang);
                console.log('Available keys in this language:', Object.keys(window.translations[currentLang]));
                // Try fallback to English
                if (fallbackTranslations['en'][key]) {
                    console.log('Using English fallback for:', key);
                    return fallbackTranslations['en'][key];
                }
                return key;
            }
        } else {
            console.log('No translations available for language:', currentLang);
            console.log('Available languages:', window.translations ? Object.keys(window.translations) : 'none');
            // Use fallback translations
            if (fallbackTranslations['en'][key]) {
                console.log('Using English fallback for:', key);
                return fallbackTranslations['en'][key];
            }
            return key;
        }
    }
}

// Initialize tour when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.platformTour = new PlatformTour();
    
    // Listen for language changes to update tour content
    window.addEventListener('languageChanged', function() {
        if (window.platformTour && window.platformTour.isActive) {
            // Update current step with new language
            window.platformTour.showStep(window.platformTour.currentStep);
        }
    });
});

/* Add tour restart functionality to user dropdown
document.addEventListener('DOMContentLoaded', function() {
    const userDropdown = document.querySelector('.user-dropdown-content');
    if (userDropdown) {
        const tourBtn = document.createElement('button');
        tourBtn.className = 'theme-btn';
        tourBtn.id = 'restart-tour-btn';
        tourBtn.innerHTML = '<span data-translate="tour-restart">Restart Tour</span>';
        tourBtn.onclick = function() {
            if (window.platformTour) {
                window.platformTour.restartTour();
            }
        };
        
        // Insert before logout button
        const logoutBtn = userDropdown.querySelector('#logout-btn');
        if (logoutBtn) {
            logoutBtn.parentNode.insertBefore(tourBtn, logoutBtn);
        } else {
            userDropdown.appendChild(tourBtn);
        }
    }
    
    // Listen for language changes to update restart tour button
    window.addEventListener('languageChanged', function() {
        const restartBtn = document.querySelector('#restart-tour-btn span');
        if (restartBtn && window.translations) {
            const currentLang = localStorage.getItem('language') || 'en';
            const translation = window.translations[currentLang] && window.translations[currentLang]['tour-restart'];
            if (translation) {
                restartBtn.textContent = translation;
            }
        }
    });
    
    // Add test tour function to window for debugging
    window.testTour = function() {
        console.log('Testing tour...');
        console.log('Available translations:', window.translations);
        if (window.platformTour) {
            // Clear any existing tour completion
            const user = JSON.parse(localStorage.getItem('user') || 'null');
            if (user && user.username) {
                localStorage.removeItem(`tour_seen_${user.id || user.username}`);
                localStorage.removeItem(`tour_completed_${user.username}`);
            }
            window.platformTour.startTour();
        } else {
            console.log('Tour not initialized');
        }
    };
});
*/
