frappe.ui.form.on('Request for Quotation', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            // Add button to the form itself
            frm.add_custom_button(__('Suppliers Quotations Grouped'), function() {
                // Create a list to hold promises of document creation
                let promises = [];

                // Iterate over each supplier in the child table
                frm.doc.suppliers.forEach(supplier_row => {
                    // Create a new Supplier Quotation for each supplier
                    let supplier_quotation = frappe.model.get_new_doc('Supplier Quotation');
                    supplier_quotation.supplier = supplier_row.supplier;  // Mapping the supplier field
                    supplier_quotation.transaction_date = frappe.datetime.nowdate(); 
                    supplier_quotation.custom_material_request = frm.doc.custom_material_request;
                    supplier_quotation.custom_bill_of_quantity = frm.doc.custom_lead;
                    supplier_quotation.custom_request_for_quotation = frm.doc.name; // Setting the current date

                    // Map the items from RFQ to Supplier Quotation
                    supplier_quotation.items = frm.doc.items.map(item => ({
                        item_code: item.item_code,
                        item_name: item.item_name,
                        description: item.description,
                        qty: item.qty,
                        rate: item.rate,
                        material_request: item.material_request,
                        material_request_item: item.material_request_item,
                        request_for_quotation: frm.doc.name,
                        request_for_quotation_item: item.name,
                        custom_bill_of_quanitity: item.custom_bill_of_quantity,
                        custom_bill_of_quanitity_item: item.custom_bill_of_quantity_item,
                        warehouse: item.warehouse
                    }));

                    // Insert the new Supplier Quotation document and add to promises
                    let promise = frappe.db.insert(supplier_quotation).then(doc => {
                        // Navigate to the newly created Supplier Quotation
                        frappe.set_route('Form', 'Supplier Quotation', doc.name);
                        return doc;
                    });

                    promises.push(promise);
                });

                // Execute all promises and show a success message when all Supplier Quotations are created
                Promise.all(promises).then(() => {
                    frappe.msgprint(__('Supplier Quotations created and opened.'));
                }).catch(err => {
                    frappe.msgprint(__('An error occurred: {0}', [err.message]));
                });
            }, __('Create'));
        }
    }
});
