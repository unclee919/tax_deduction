frappe.ui.form.on('Lead', {
    refresh: function (frm) {
        if (frm.doc.docstatus === 0) {  // Ensure the lead is not submitted
        frm.page.add_inner_button(__('Quotation'), function() {
            create_quotation(frm);
        }, __('Create'));
        }
    }
});

function create_quotation(frm) {
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Lead',
            name: frm.doc.name
        },
        callback: function (response) {
            var lead = response.message;

            var quotation = {
                doctype: 'Quotation',
                customer_name: lead.customer_name,
                contact_person: lead.contact_person,
                quotation_to: "Lead",
                party_name: lead.name,
                items: lead.custom_bill_of_quantity.map(item => ({
                    item_code: item.product_code,        // Adjust based on actual field names in custom_bill_of_quantity
                    item_name: item.product_name,
                    description: item.description,
                    qty: item.qty,
                    rate: item.final_rate
                }))
            };

            frappe.call({
                method: 'frappe.client.insert',
                args: {
                    doc: quotation
                },
                callback: function (response) {
                    if (response.exc) {
                        frappe.msgprint(__('Error creating Quotation.'));
                        console.error(response.exc);
                        return;
                    }

                    var docname = response.message.name;
                    frappe.msgprint(__('Quotation {0} created', [docname]));
                    frappe.set_route('form', 'Quotation', docname);
                },
                error: function (response) {
                    frappe.msgprint(__('Error creating Quotation.'));
                    console.error(response);
                }
            });
        },
        error: function (response) {
            frappe.msgprint(__('Error fetching Lead.'));
            console.error(response);
        }
    });
}
