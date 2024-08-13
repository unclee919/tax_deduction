frappe.ui.form.on('Request for Quotation', {
    refresh: function(frm) {
        frm.add_custom_button(__('Create Quotation'), function() {
            frappe.call({
                method: '/home/pc/frappe-bench-15/apps/hid/hid/public/js/Request for Quotation.js',
                args: {
                    rfq_name: frm.doc.name
                },
                callback: function(response) {
                    if (response.message) {
                        frappe.msgprint(__('Supplier Quotations Created: {0}', [response.message.join(', ')]));
                    }
                }
            });
        });
    }
});
