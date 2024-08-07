frappe.ui.form.on('Supplier Quotation', {
    refresh: function(frm) {
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Update Original BoQ'), function() {
                if (!frm.doc.items || frm.doc.items.length === 0) {
                    frappe.msgprint(__('No items found in the Supplier Quotation.'));
                    return;
                }

                let lead_updates = {}; // To keep track of lead updates
                let errorMessages = [];
                let updatedLeads = new Set(); // To keep track of leads that are updated
                let skippedLeads = new Set(); // To keep track of leads that are skipped

                // Show progress while updates are being processed
                frappe.msgprint(__('Updating BoQ Items... Please wait.'));

                // Fetch all Leads in parallel
                let leadPromises = frm.doc.items.map(item => {
                    if (!item.custom_bill_of_quanitity || !item.custom_bill_of_quanitity_item) {
                        errorMessages.push(__('Missing Bill of Quantity or Bill of Quantity Item for item {0}.', [item.item_code]));
                        return Promise.resolve(); // Skip this item
                    }

                    return frappe.db.get_doc('Lead', item.custom_bill_of_quanitity).then(lead => {
                        if (!lead || !lead.custom_bill_of_quantity) {
                            let errorMessage = __('Lead {0} is not valid or does not have a Bill of Quantity child table.', [item.custom_bill_of_quanitity]);
                            errorMessages.push(errorMessage);
                            return Promise.resolve(); // Skip this Lead
                        }

                        // Check the custom_lead_stage field
                        return frappe.db.get_doc('Project Stage', lead.custom_lead_stage).then(stage => {
                            if (stage.close_costing_update && !skippedLeads.has(lead.name)) {
                                let message = __('Costing update for Lead {0} is not allowed as per the Project Stage settings.', [lead.name]);
                                errorMessages.push(message);
                                skippedLeads.add(lead.name); // Mark this lead as skipped
                                return Promise.resolve(); // Skip this Lead
                            }

                            if (!lead_updates[lead.name]) {
                                lead_updates[lead.name] = lead;
                            }

                            let boq_item = lead_updates[lead.name].custom_bill_of_quantity.find(
                                boq_item => boq_item.name === item.custom_bill_of_quanitity_item
                            );

                            if (boq_item) {
                                boq_item.initial_cost_in_product_currency = item.rate;
                                boq_item.cost_get = 1; // Mark the item
                                updatedLeads.add(lead.name); // Mark this lead as updated
                            } else {
                                let message = __('Bill of Quantity Item {0} not found in Lead\'s Bill of Quantity.', [item.custom_bill_of_quanitity_item]);
                                errorMessages.push(message);
                            }

                            return Promise.resolve(); // Continue processing
                        }).catch(err => {
                            let errorMessage = err.message || __('Error retrieving Project Stage for Lead {0}.', [lead.custom_bill_of_quanitity]);
                            errorMessages.push(errorMessage);
                            return Promise.resolve(); // Continue processing
                        });
                    }).catch(err => {
                        let errorMessage = err.message || __('Error retrieving Lead {0}.', [item.custom_bill_of_quanitity]);
                        errorMessages.push(errorMessage);
                        return Promise.resolve(); // Continue processing
                    });
                });

                Promise.all(leadPromises).then(() => {
                    // Save all updated Leads in parallel
                    let savePromises = Array.from(updatedLeads).map(lead_name => {
                        if (skippedLeads.has(lead_name)) {
                            // Skip saving this lead since it was marked to be skipped
                            return Promise.resolve();
                        }

                        let lead_doc = lead_updates[lead_name];
                        return frappe.db.set_value('Lead', lead_doc.name, { 'custom_bill_of_quantity': lead_doc.custom_bill_of_quantity }).then(() => {
                            return Promise.resolve(__('Lead {0} updated successfully.', [lead_doc.name]));
                        }).catch(err => {
                            let errorMessage = err.message || __('Error updating Lead {0}.', [lead_doc.name]);
                            errorMessages.push(errorMessage);
                            return Promise.reject(new Error(errorMessage));
                        });
                    });

                    return Promise.all(savePromises);
                }).then(results => {
                    let successMessages = results.filter(result => typeof result === 'string');
                    if (errorMessages.length > 0) {
                        frappe.msgprint({
                            title: __('Some Errors Occurred'),
                            indicator: 'red',
                            message: errorMessages.join('<br>')
                        });
                    }
                    if (successMessages.length > 0) {
                        frappe.msgprint({
                            title: __('Update Complete'),
                            indicator: 'green',
                            message: successMessages.join('<br>')
                        });
                    } else if (errorMessages.length === 0) {
                        frappe.msgprint(__('All applicable Leads have been updated.'));
                    }
                }).catch(err => {
                    frappe.msgprint(__('An error occurred: {0}', [err.message || 'Unknown error']));
                });
            }, __('Update'));
        }
    }
});
