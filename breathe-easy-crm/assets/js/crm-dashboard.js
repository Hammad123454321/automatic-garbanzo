/* Breathe Easy CRM — Dashboard JS */
/* global beCRM, Chart, jQuery */

(function ($) {
    'use strict';

    const ajax  = beCRM.ajaxUrl;
    const nonce = beCRM.nonce;

    /* ── Toast ───────────────────────────────────────────────────── */
    function toast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = 'be-toast be-toast-' + type;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px)';
            el.style.transition = 'all .3s';
            setTimeout(() => el.remove(), 300);
        }, 3000);
    }

    /* ── Modal: Open ─────────────────────────────────────────────── */
    function openModal(leadData = null) {
        const modal = document.getElementById('be-lead-modal');
        const title = document.getElementById('be-modal-title');
        const form  = document.getElementById('be-lead-form');
        if (!modal) return;

        form.reset();

        if (leadData) {
            title.textContent = 'Edit Lead';
            document.getElementById('be-lead-id').value    = leadData.id || 0;
            document.getElementById('be-f-name').value     = leadData.name     || '';
            document.getElementById('be-f-email').value    = leadData.email    || '';
            document.getElementById('be-f-phone').value    = leadData.phone    || '';
            document.getElementById('be-f-location').value = leadData.location || '';
            document.getElementById('be-f-message').value  = leadData.message  || '';
            document.getElementById('be-f-notes').value    = leadData.notes    || '';
            document.getElementById('be-f-value').value    = leadData.value    || '';
            setSelect('be-f-service',  leadData.service);
            setSelect('be-f-stage',    leadData.stage);
            setSelect('be-f-priority', leadData.priority);
        } else {
            title.textContent = 'Add New Lead';
            document.getElementById('be-lead-id').value = 0;
        }

        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('be-f-name').focus(), 50);
    }

    function setSelect(id, value) {
        const el = document.getElementById(id);
        if (el && value) el.value = value;
    }

    /* ── Modal: Close ─────────────────────────────────────────────  */
    function closeModal() {
        const modal = document.getElementById('be-lead-modal');
        if (modal) modal.style.display = 'none';
    }

    /* ── Fetch lead data and open modal ──────────────────────────── */
    function editLead(leadId) {
        $.get(ajax, { action: 'be_get_lead', nonce, lead_id: leadId }, function (res) {
            if (res.success) openModal(res.data);
            else toast('Could not load lead data.', 'error');
        });
    }

    /* ── Update stage via dropdown ───────────────────────────────── */
    function updateStage(leadId, stage, el) {
        const row = $(el).closest('tr, .be-lead-card');
        row.addClass('be-loading');

        $.post(ajax, { action: 'be_update_stage', nonce, lead_id: leadId, stage }, function (res) {
            row.removeClass('be-loading');
            if (res.success) {
                toast('Stage updated successfully!');
                // Update colour of the select if possible
                const option = $(el).find('option:selected');
                const color  = option.data('color');
                if (color) $(el).css({ borderLeftColor: color, borderLeftWidth: '3px' });
            } else {
                toast('Failed to update stage.', 'error');
            }
        });
    }

    /* ── Save lead form ──────────────────────────────────────────── */
    function saveLead(formEl) {
        const data    = $(formEl).serialize();
        const btn     = $(formEl).find('button[type="submit"]');
        const origTxt = btn.html();
        btn.html('<span class="be-spinner"></span> Saving…').prop('disabled', true);

        $.post(ajax, data + '&action=be_save_lead&nonce=' + nonce, function (res) {
            btn.html(origTxt).prop('disabled', false);
            if (res.success) {
                toast(res.data.action === 'created' ? '✅ Lead created!' : '✅ Lead updated!');
                closeModal();
                setTimeout(() => location.reload(), 800);
            } else {
                toast('Failed to save lead.', 'error');
            }
        });
    }

    /* ── Delete lead ─────────────────────────────────────────────── */
    function deleteLead(leadId) {
        if (!confirm('Delete this lead? This cannot be undone.')) return;

        $.post(ajax, { action: 'be_delete_lead', nonce, lead_id: leadId }, function (res) {
            if (res.success) {
                const row = $('[data-lead-id="' + leadId + '"]').first();
                row.css({ transition: 'all .3s', opacity: 0, transform: 'translateX(-20px)' });
                setTimeout(() => { row.remove(); toast('Lead deleted.'); }, 300);
            } else {
                toast('Failed to delete lead.', 'error');
            }
        });
    }

    /* ── Bind Events ─────────────────────────────────────────────── */
    $(document).ready(function () {

        // Add lead button
        $(document).on('click', '#be-add-lead-btn', () => openModal());

        // Close modal
        $(document).on('click', '#be-modal-close, #be-modal-cancel', closeModal);
        $(document).on('click', '.be-modal-overlay', function (e) {
            if (e.target === this) closeModal();
        });

        // ESC to close
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });

        // Edit lead button
        $(document).on('click', '.be-edit-lead', function () {
            const leadId = $(this).data('lead-id');
            if (leadId) editLead(leadId);
        });

        // Delete lead
        $(document).on('click', '.be-delete-lead', function () {
            const leadId = $(this).data('lead-id');
            if (leadId) deleteLead(leadId);
        });

        // Stage select in table
        $(document).on('change', '.be-stage-select, .be-stage-select-inline', function () {
            const leadId = $(this).data('lead-id');
            const stage  = $(this).val();
            if (leadId && stage) updateStage(leadId, stage, this);
        });

        // Save lead form submit
        $(document).on('submit', '#be-lead-form', function (e) {
            e.preventDefault();
            saveLead(this);
        });

        // Kanban card click → open edit
        $(document).on('click', '.be-lead-card', function (e) {
            // Don't open if clicking a button, select, or link inside
            if ($(e.target).is('button, select, a, input, .be-icon-btn, .be-stage-select-inline, .be-lead-phone')) return;
            const leadId = $(this).data('lead-id');
            if (leadId) editLead(leadId);
        });

        // Stage select colour update on load
        $('.be-stage-select').each(function () {
            const opt   = $(this).find('option:selected');
            const color = opt.data('color');
            if (color) $(this).css({ borderLeftColor: color, borderLeftWidth: '3px' });
        });

        /* ── Pipeline Chart ──────────────────────────────────────── */
        const chartCanvas = document.getElementById('be-pipeline-chart');
        if (chartCanvas && beCRM.pipeline && beCRM.pipeline.length) {
            const labels = beCRM.pipeline.map(s => s.name);
            const counts = beCRM.pipeline.map(s => s.count);
            const colors = beCRM.pipeline.map(s => s.color);

            new Chart(chartCanvas, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: counts,
                        backgroundColor: colors,
                        borderColor: '#fff',
                        borderWidth: 3,
                        hoverOffset: 6,
                    }],
                },
                options: {
                    cutout: '68%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                font: { size: 12, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
                                padding: 14,
                                usePointStyle: true,
                                pointStyleWidth: 10,
                            },
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => ' ' + ctx.label + ': ' + ctx.parsed + ' leads',
                            },
                        },
                    },
                    animation: { animateScale: true, duration: 600 },
                },
            });
        }

        /* ── Auto-refresh stats every 60 seconds ─────────────────── */
        setInterval(function () {
            $.get(ajax, { action: 'be_get_stats_partial', nonce }, function (res) {
                if (res && res.success) {
                    // Update stat values silently if elements exist
                    const s = res.data;
                    updateStatEl('stat-today-leads',     s.today_leads);
                    updateStatEl('stat-active-pipeline', s.active_pipeline);
                    updateStatEl('stat-booked',          s.booked);
                    updateStatEl('stat-total-contacts',  s.total_contacts);
                }
            });
        }, 60000);

        function updateStatEl(id, val) {
            const el = document.getElementById(id);
            if (el && el.textContent !== String(val)) {
                el.style.transition = 'all .3s';
                el.style.transform  = 'scale(1.1)';
                el.textContent      = val;
                setTimeout(() => { el.style.transform = 'scale(1)'; }, 300);
            }
        }

        /* ── Smooth search filter on leads table ──────────────────── */
        const searchInput = document.querySelector('.be-search-input');
        if (searchInput && !searchInput.closest('form')) {
            searchInput.addEventListener('input', function () {
                const q = this.value.toLowerCase();
                document.querySelectorAll('.be-table tbody tr').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
                });
            });
        }

    }); // end ready

}(jQuery));

/* ── AJAX: Stats partial (for auto-refresh) ──────────────────────── */
// Server-side handler
(function () {
    if (typeof window.be_stats_handler_registered !== 'undefined') return;
    window.be_stats_handler_registered = true;
})();
