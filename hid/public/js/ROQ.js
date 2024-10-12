// import frappe
// from frappe.utils import nowdate

// @frappe.whitelist()
// def create_quotations_from_material_request(material_request_name):
//     try:
//         # Get the material request document
//         material_request = frappe.get_doc('Material Request', material_request_name)
        
//         # Group items by supplier
//         supplier_items = {}
//         for item in material_request.items:
//             if item.supplier:
//                 if item.supplier not in supplier_items:
//                     supplier_items[item.supplier] = []
//                 supplier_items[item.supplier].append(item)
        
//         # Create quotations based on grouped suppliers
//         for supplier, items in supplier_items.items():
//             rfq = frappe.get_doc({
//                 'doctype': 'Request for Quotation',
//                 'supplier': supplier,
//                 'transaction_date': nowdate(),
//                 'status': 'Draft'
//             })
            
//             for item in items:
//                 rfq.append('items', {
//                     'item_code': item.item_code,
//                     'qty': item.qty,
//                     'rate': item.rate,
//                     'uom': item.uom
//                 })
            
//             # Save RFQ (optional, can be removed if you want to keep it as a draft)
//             rfq.insert(ignore_permissions=True)
//             # rfq.submit() # Uncomment if you want to submit RFQ immediately

//         frappe.db.commit()
//         return "Quotations created successfully"
//     except Exception as e:
//         frappe.log_error(frappe.get_traceback(), "Error in creating quotations from Material Request")
//         return str(e)





// image_view_custom.bundle.js

// -----------------------------

// Override frappe.views.ImageView Class


frappe.provide("frappe.views");


frappe.views.ImageView = class ImageViewCustom extends frappe.views.ImageView {
    item_details_html(item) {
        // TODO: Image view field in DocType
        let info_fields = this.get_fields_in_list_view().map((el) => el) || [];
        const title_field = this.meta.title_field || "name";
        info_fields = info_fields.filter((field) => field.fieldname !== title_field);
        let info_html = `<div><ul class="list-unstyled image-view-info">`;
        let set = false;
        info_fields.forEach((field, index) => {
            if (item[field.fieldname] && !set) {
                if (index == 0) info_html += `<li><b>${__(field.label)}: </b> ${__(item[field.fieldname])}</li>`;
                else info_html += `<li class="text-muted"><b>${__(field.label)}: </b> ${__(item[field.fieldname])}</li>`;
                // set = true; // Comment
            }
        });
        info_html += `</ul></div>`;
        return info_html;
    }
}


frappe.ui.form.on('Supplier Quotation', {
    refresh: function(frm) {
        // Check the status directly from frm.doc
        if (frm.doc.status === "Submitted") {
            frm.add_custom_button(__('Update Original BoQ'), function() {
                if (!frm.doc.items || frm.doc.items.length === 0) {
                    frappe.msgprint(__('No items found in the Supplier Quotation.'));
                    return;
                }

                let lead_updates = {}; // To keep track of lead updates
                let errorMessages = [];
                let updatedLeads = new Set(); // To keep track of leads that are updated
                let skippedLeads = new Set(); // To keep track of leads that are skipped
                let itemUpdates = []; // To keep track of item updates

                // Show progress while updates are being processed
                frappe.msgprint(__('Updating BoQ Items... Please wait.'));

                // Fetch all Leads in parallel
                let leadPromises = frm.doc.items.map(item => {
                    if (!item.custom_bill_of_quanitity || !item.custom_bill_of_quanitity_item) {
                        errorMessages.push(__('Missing Bill of Quantity or Bill of Quantity Item for item {0}.', [item.item_code]));
                        return Promise.resolve(); // Skip this item
                    }

                    // Update Lead BoQ item status to "Quoted"
                    let leadPromise = frappe.call({
                        method: 'frappe.client.get',
                        args: {
                            doctype: 'Lead',
                            name: item.custom_bill_of_quanitity
                        }
                    }).then(response => {
                        let lead = response.message;
                        if (!lead || !lead.custom_bill_of_quantity) {
                            let errorMessage = __('Lead {0} is not valid or does not have a Bill of Quantity child table.', [item.custom_bill_of_quanitity]);
                            errorMessages.push(errorMessage);
                            return Promise.resolve(); // Skip this Lead
                        }

                        // Check the custom_lead_stage field
                        return frappe.call({
                            method: 'frappe.client.get',
                            args: {
                                doctype: 'Project Stage',
                                name: lead.custom_lead_stage
                            }
                        }).then(response => {
                            let stage = response.message;
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
                                boq_item.status = 'Quoted'; // Update status to Quoted
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

                    // Update Item custom_status to "Quoted"
                    let itemPromise = frappe.call({
                        method: 'frappe.client.get',
                        args: {
                            doctype: 'Item',
                            name: item.item_code
                        }
                    }).then(response => {
                        let itemDoc = response.message;
                        if (itemDoc) {
                            itemDoc.custom_status = 'Quoted'; // Update custom_status to "Quoted"
                            itemUpdates.push(itemDoc); // Store the updated item record for saving
                        } else {
                            let message = __('Item {0} not found.', [item.item_code]);
                            errorMessages.push(message);
                        }
                        return Promise.resolve();
                    }).catch(err => {
                        let errorMessage = err.message || __('Error retrieving Item {0}.', [item.item_code]);
                        errorMessages.push(errorMessage);
                        return Promise.resolve(); // Continue processing
                    });

                    return Promise.all([leadPromise, itemPromise]);
                });

                Promise.all(leadPromises).then(() => {
                    // Save all updated Leads in parallel
                    let saveLeadPromises = Array.from(updatedLeads).map(lead_name => {
                        if (skippedLeads.has(lead_name)) {
                            // Skip saving this lead since it was marked to be skipped
                            return Promise.resolve();
                        }

                        let lead_doc = lead_updates[lead_name];
                        return frappe.call({
                            method: 'frappe.client.save',
                            args: {
                                doc: lead_doc
                            }
                        }).then(() => {
                            return Promise.resolve(__('Lead {0} updated successfully.', [lead_doc.name]));
                        }).catch(err => {
                            let errorMessage = err.message || __('Error updating Lead {0}.', [lead_doc.name]);
                            errorMessages.push(errorMessage);
                            return Promise.reject(new Error(errorMessage));
                        });
                    });

                    // Save all updated Items in parallel
                    let saveItemPromises = itemUpdates.map(itemDoc => {
                        return frappe.call({
                            method: 'frappe.client.save',
                            args: {
                                doc: itemDoc
                            }
                        }).then(() => {
                            return Promise.resolve(__('Item {0} updated successfully.', [itemDoc.name]));
                        }).catch(err => {
                            let errorMessage = err.message || __('Error updating Item {0}.', [itemDoc.name]);
                            errorMessages.push(errorMessage);
                            return Promise.reject(new Error(errorMessage));
                        });
                    });

                    return Promise.all([...saveLeadPromises, ...saveItemPromises]);
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
                        frappe.msgprint(__('All applicable Leads and Items have been updated.'));
                    }
                }).catch(err => {
                    frappe.msgprint(__('An error occurred: {0}', [err.message || 'Unknown error']));
                });
            }, __('Update'));
        }
    }
});









frappe.ui.form.on('Material Request', {
    refresh: function (frm) {
        if (frm.doc.status !== "Draft" && frappe.user.has_role('Purchase User')) {
            frm.add_custom_button(__('Create Quotations'), function () {
                console.log('Create Quotations button clicked.');

                // Fetch the Material Request document
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Material Request',
                        name: frm.doc.name
                    },
                    callback: function (response) {
                        if (!response.message) {
                            frappe.msgprint(__('Material Request document not found.'));
                            return;
                        }

                        const materialRequest = response.message;

                        // Debugging: Check the fetched materialRequest
                        console.log('Fetched Material Request:', materialRequest);

                        // Group items by custom_supplier
                        let supplierItems = {};
                        if (materialRequest.items && materialRequest.items.length > 0) {
                            materialRequest.items.forEach(item => {
                                console.log('Processing item:', item);

                                if (item.custom_supplier) {
                                    if (!supplierItems[item.custom_supplier]) {
                                        supplierItems[item.custom_supplier] = [];
                                    }
                                    supplierItems[item.custom_supplier].push(item);
                                } else {
                                    console.log('Item has no custom_supplier:', item);
                                }
                            });

                            console.log('Grouped items by custom_supplier:', supplierItems);
                        } else {
                            console.log('No items found in material request.');
                        }

                        // Create quotations based on grouped suppliers
                        for (let customSupplier in supplierItems) {
                            let items = supplierItems[customSupplier];
                            
                            if (items.length === 0) {
                                console.log('No items for supplier:', customSupplier);
                                continue;
                            }

                            // Create a new RFQ document
                            let rfq = frappe.model.get_new_doc('Request for Quotation');
                            rfq.transaction_date = frappe.datetime.now_date();
                            rfq.status = 'Draft';
                            rfq.message_for_supplier = "Please supply the specified items at the best possible rates";
                            rfq.custom_material_request = frm.doc.name ;
                            rfq.custom_lead = frm.doc.custom_from_bill_of_quantity;

                            // Add the supplier to the RFQ's suppliers child table
                            let supplierEntry = frappe.model.add_child(rfq, 'suppliers', 'suppliers');
                            supplierEntry.supplier = customSupplier; // Map custom_supplier to supplier in child table

                            items.forEach(item => {
                                let new_item = frappe.model.add_child(rfq, 'items', 'items');
                                new_item.item_code = item.item_code;
                                new_item.qty = item.qty;
                                new_item.rate = item.rate;
                                new_item.uom = item.uom;
                                new_item.warehouse = item.warehouse; // Map warehouse field
                                new_item.conversion_factor = 1; 
                                new_item.material_request = frm.doc.name;
                                new_item.material_request_item = item.name;
                                new_item.custom_bill_of_quantity = item.custom_from_bill_of_quantity;
                                new_item.custom_bill_of_quantity_item = item.custom_from_bill_of_quantity_item;

                                console.log('Added item to RFQ:', new_item);
                            });

                            console.log('Created RFQ document:', rfq);

                            // Insert and submit the RFQ
                            frappe.call({
                                method: 'frappe.client.insert',
                                args: {
                                    doc: rfq
                                },
                                callback: function (response) {
                                    if (response.message) {
                                        let rfqName = response.message.name;
                                        let rfqUrl = `#Form/Request%20for%20Quotation/${encodeURIComponent(rfqName)}`;
                                        let message = __('Quotation created successfully: ') +
                                        `<a href="${rfqUrl}" target="_blank">${rfqName}</a>`;

                                        // let rfqUrl = `#Form/Request%20for%20Quotation/${encodeURIComponent(rfqName)}`;
                                        // let message = __('Quotation created successfully for supplier: ') +
                                        //               `<a href="${rfqUrl}" target="_blank">${customSupplier}</a>`;
                                        frappe.msgprint({ message: message, indicator: 'green' });
                                        console.log('RFQ created:', response.message);
                                    }
                                },
                                error: function (error) {
                                    frappe.msgprint(__('Failed to create quotation for supplier: ') + customSupplier + ': ' + error.message);
                                    console.error('Error creating RFQ:', error);
                                }
                            });
                        }
                    },
                    error: function (error) {
                        frappe.msgprint(__('Failed to fetch material request: ') + error.message);
                        console.error('Error fetching material request:', error);
                    }
                });
            });
        }
    },

    on_submit: function(frm) {
        console.log('Material Request Submitted.');

        // Loop through each item in the Material Request
        frm.doc.items.forEach(item => {
            // Update the Lead Doctype for custom_bill_of_quantity
            if (item.custom_from_bill_of_quantity && item.custom_from_bill_of_quantity_item) {
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Lead',
                        name: item.custom_from_bill_of_quantity
                    },
                    callback: function(response) {
                        if (response.message) {
                            let lead = response.message;

                            // Find the matching row in custom_bill_of_quantity table
                            let boq_item = lead.custom_bill_of_quantity.find(boq_item => boq_item.name === item.custom_from_bill_of_quantity_item);

                            if (boq_item) {
                                // Update the status to "Ready for Purchase"
                                boq_item.status = "Ready for Purchase";

                                // Save the updated Lead document
                                frappe.call({
                                    method: 'frappe.client.save',
                                    args: {
                                        doc: lead
                                    },
                                    callback: function(saveResponse) {
                                        if (saveResponse.message) {
                                            console.log(`Lead ${lead.name} updated with status for BoQ item ${boq_item.name}`);
                                        }
                                    },
                                    error: function(error) {
                                        console.error(`Error updating Lead ${lead.name}:`, error);
                                    }
                                });
                            }
                        }
                    },
                    error: function(error) {
                        console.error(`Error fetching Lead ${item.custom_from_bill_of_quantity}:`, error);
                    }
                });
            }

            // Update the Item's custom_status
            if (item.item_code) {
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Item',
                        name: item.item_code
                    },
                    callback: function(response) {
                        if (response.message) {
                            let item_doc = response.message;

                            // Update the custom_status field
                            item_doc.custom_status = "Ready for Purchase";

                            // Save the updated Item document
                            frappe.call({
                                method: 'frappe.client.save',
                                args: {
                                    doc: item_doc
                                },
                                callback: function(saveResponse) {
                                    if (saveResponse.message) {
                                        console.log(`Item ${item_doc.item_code} updated with status.`);
                                    }
                                },
                                error: function(error) {
                                    console.error(`Error updating Item ${item_doc.item_code}:`, error);
                                }
                            });
                        }
                    },
                    error: function(error) {
                        console.error(`Error fetching Item ${item.item_code}:`, error);
                    }
                });
            }
        });
    }
});
