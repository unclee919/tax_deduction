
async function createItemsFromBoQ(frm) {
    console.log("createItemsFromBoQ function called");
    let itemsCreated = 0;
    let itemsSkipped = 0;
    let itemsUpdated = 0;
    const processedItemCodes = new Set();
    const productCountMap = new Map();

    async function checkItemExists(product_code) {
        if (!product_code) {
            console.error("Invalid product_code for checkItemExists.");
            return false;
        }
        try {
            return await frappe.db.exists('Item', product_code);
        } catch (err) {
            console.error(`Error checking item existence for "${product_code}":`, err);
            throw err;
        }
    }

    async function getItem(product_code) {
        if (!product_code) {
            console.error("Invalid product_code for getItem.");
            return null;
        }
        try {
            return await frappe.db.get_doc('Item', product_code);
        } catch (err) {
            console.error(`Error retrieving item with product_code "${product_code}":`, err);
            throw err;
        }
    }

    async function updateItem(item_code, itemData) {
        console.log("updateItem function called for", item_code);
        try {
            const response = await frappe.call({
                method: 'frappe.client.set_value',
                args: {
                    doctype: 'Item',
                    name: item_code,
                    fieldname: itemData
                }
            });

            if (!response.exc) {
                itemsUpdated++;
                processedItemCodes.add(item_code);
                await updateRowInForm(frm, item_code);
            } else {
                console.error(`Error updating item with product_code "${item_code}":`, response.message);
            }
        } catch (err) {
            console.error(`Error updating item with product_code "${item_code}":`, err);
        }
    }

    async function createItem(itemData) {
        console.log("createItem function called for", itemData.item_code);
        const item_doc = frappe.model.get_new_doc('Item');
        Object.assign(item_doc, itemData);

        try {
            const new_item = await frappe.db.insert(item_doc);
            itemsCreated++;
            processedItemCodes.add(itemData.item_code);
            await updateRowInForm(frm, new_item.item_code);
        } catch (err) {
            console.error(`Error creating item with product_code "${itemData.item_code}":`, err);
            itemsSkipped++;
            frappe.msgprint(`Error creating item with product_code "${itemData.item_code}": ${err.message || 'Unknown error'}`);
        }
    }
    function generateHidCode(baseCode, suffix = '', floorLevel = '', roomNumber = '') {
        let code = '';
        if (floorLevel) code += `${floorLevel}`;
        if (roomNumber) code += `${roomNumber}`;
        code += `-${baseCode}`;
        if (suffix) code += `-${suffix}`;
        return code;
    }
    
    async function generateComponentHidCode(frm) {
        let lastMainProductCode = null;
        let lastMainProductProductCode = null;
        let currentSuffix = 'A';
        let floorLevel = null;
        let roomNumber = null;
    
        try {
            for (let idx = 0; idx < frm.doc.bill_of_quantity.length; idx++) {
                let row = frm.doc.bill_of_quantity[idx];
                floorLevel = row.floor_level || floorLevel; // Use the row's floor_level if available
                roomNumber = row.room_number || roomNumber; // Use the row's room_number if available
    
                if (row.is_component === 0) {
                    if (!row.hid_code) {
                        lastMainProductCode = generateNewBaseCode(frm, floorLevel, roomNumber);
                        await frappe.model.set_value(row.doctype, row.name, 'hid_code', lastMainProductCode);
                    } else {
                        lastMainProductCode = row.hid_code;
                    }
    
                    lastMainProductProductCode = row.product_code;
                    currentSuffix = 'A';
                } else if (row.is_component === 1 && lastMainProductCode && lastMainProductProductCode && !row.hid_code) {
                    let componentHidCode = generateHidCode(lastMainProductCode, currentSuffix, floorLevel, roomNumber);
                    await frappe.model.set_value(row.doctype, row.name, 'hid_code', componentHidCode);
                    await frappe.model.set_value(row.doctype, row.name, 'parent_item', lastMainProductProductCode);
                    currentSuffix = String.fromCharCode(currentSuffix.charCodeAt(0) + 1);
                }
            }
    
            frm.refresh_field('bill_of_quantity');
        } catch (error) {
            console.error("Error processing HID code generation:", error);
        }
    }
    

    function generateNewBaseCode(frm, floorLevel = '', roomNumber = '') {
        const mainProductCodes = frm.doc.bill_of_quantity
            .filter(row => row.is_component === 0 && row.hid_code)
            .map(row => row.hid_code);
    
        let baseCode = '001'; // Start from '001' if there are no existing codes
        if (mainProductCodes.length > 0) {
            // Extract and increment the numeric part from the last code
            const lastCode = mainProductCodes.sort().pop();
            const parts = lastCode.split('-');
            const numberPart = parts[parts.length - 1];
            baseCode = String(parseInt(numberPart, 10) + 1).padStart(3, '0');
        }
    
        let code = '';
        if (floorLevel) code += `FL${floorLevel}`;
        if (roomNumber) code += `-RM${roomNumber}`;
        code += `-${baseCode}`;
        return code;
    }
    
    
    for (const row of frm.doc.bill_of_quantity) {
        console.log("Processing row:", row); 
    
        // Ensure required fields for processing
        if (row.product_name && row.uom) {
            if (!productCountMap.has(row.base_code)) {
                productCountMap.set(row.base_code, 0);
            }
    
            const index = productCountMap.get(row.base_code) + 1;
            productCountMap.set(row.base_code, index);
    
            if (row.is_component) {
                await generateComponentHidCode(frm);
            } else {
                const base_code = frm.is_new() ? row.base_code : row.base_code;
                const formatindex = String(index).padStart(3, '0');
                if (!row.hid_code) {row.hid_code = generateHidCode(base_code, formatindex);}
                // row.hid_code = generateHidCode(base_code, formatindex);
            }
    
            try {
                const itemData = createItemData(row, frm);
    
                if (row.product_code) {
                    // Check if the item exists and update if needed
                    const exists = await checkItemExists(row.product_code);
                    if (exists) {
                        const existingItem = await getItem(row.product_code);
                        if (existingItem && hasDifferences(existingItem, itemData)) {
                            await updateItem(row.product_code, itemData);
                            itemsUpdated++;
                        } else {
                            itemsSkipped++;
                            console.log(`No changes detected for item with product_code "${row.product_code}".`);
                        }
                    } else {
                        await createItem(itemData); // Create item if it doesn't exist
                        itemsCreated++;
                    }
                } else {
                    // Create a new item if product_code is missing
                    await createItem(itemData);
                    itemsCreated++;
                    console.log(`Created new item without product_code for row:`, row);
                }
            } catch (err) {
                console.error(`Error processing item:`, err);
                itemsSkipped++;
            }
        }
    }    
    
    // Attempt to save the form and display results
    try {
        await frm.save();
        // frappe.msgprint(`Items creation process completed. Created: ${itemsCreated}, Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}`);
    } catch (err) {
        console.error('Error saving document:', err);
        frappe.msgprint('There was an issue saving the document.');
    }
}    

function createItemData(row, frm) {
    return {
        item_code: row.hid_code,
        custom_hid_code: row.hid_code,
        item_name: row.product_name,
        stock_uom: row.uom,
        item_group: row.product_code_category,
        custom_item_link: row.item_link,
        custom_building_number: row.building_number,
        custom_area: row.area,
        custom_document: row.document,
        custom_room_name: row.room_name,
        custom_room_number: row.room_number,
        custom_floor_level: row.floor_level,
        custom_supplier: row.supplier,
        custom_supplier_part_number: row.supplier_part_number,
        custom_diemension: row.diemensions,
        custom_describition: row.descripition,
        custom_boq: frm.doc.name,
        custom_desugner_item_code: row.designer_item_code,
        custom_reference_document: row.refreference_document,
        custom_specification_details: row.specification_details,
        image: row.attach_image_wjpb,
        custom_attach: row.attach_secondary_image,
        custom_date_of_pacage: row.date_of_packge,
        custom_status: row.status,
        custom_boq_item: row.name,
        custom_item_coding: row.product_name,
        custom_is_component: row.is_component,
        custom_base_code: row.base_code,
        custom_parent_item: row.parent_item
    };
}

function hasDifferences(existingItem, newData) {
    return Object.keys(newData).some(key => existingItem[key] !== newData[key]);
}

async function updateRowInForm(frm, item_code) {
    if (!item_code) {
        console.error("Invalid item_code in updateRowInForm.");
        return;
    }

    // Integrated getItem function directly within updateRowInForm
    async function getItem(item_code) {
        if (!item_code) {
            console.error("Invalid item_code for getItem in updateRowInForm.");
            return null;
        }
        try {
            return await frappe.db.get_doc('Item', item_code);
        } catch (err) {
            console.error(`Error retrieving item with item_code "${item_code}" in updateRowInForm:`, err);
            throw err;
        }
    }

    try {
        const existingItem = await getItem(item_code);
        if (!existingItem) return;

        for (let idx = 0; idx < frm.doc.bill_of_quantity.length; idx++) {
            const row = frm.doc.bill_of_quantity[idx];
            if (row.name === existingItem.custom_boq_item) {
                frappe.model.set_value(row.doctype, row.name, 'product_code', existingItem.item_code);
                frappe.model.set_value(row.doctype, row.name, 'is_created', 1);
                break;
            }
        }
    } catch (err) {
        console.error("Error updating row in form:", err);
    }
}


// Attach event handlers
frappe.ui.form.on('Sub BOQ', {
    refresh: function(frm) {
        frm.add_custom_button(__('Update Margins'), function() {
            frm.doc.bill_of_quantity.forEach(row => {
                // calculateMargins(frm, row.doctype, row.name);
            });
            frm.save();
        });

        frm.add_custom_button(__('Create - Update Items'), function() {
            createItemsFromBoQ(frm);
        });
    },
    
    before_save: function(frm) {
        console.log("before_save event triggered");
        frm.doc.bill_of_quantity.forEach(row => {
            // calculateMargins(frm, row.doctype, row.name);
            // updateInitialCostPerUnit(frm, row.doctype, row.name);
        });
        // updatetotals(frm);
        // updateMappedFields(frm);
        
    },
    custom_update_margin: function(frm) {
        console.log("custom_update_margin event triggered");
        frm.doc.bill_of_quantity.forEach(row => {
            calculateMargins(frm, row.doctype, row.name);
        });
        frm.save();
    },
    custom_custom_and_clearnce: function(frm) {
        updateMappedFields(frm);
    },
    custom_logistics: function(frm) {
        updateMappedFields(frm);
    },
    custom_aditional_cost: function(frm) {
        updateMappedFields(frm);
    },
    custom_oh: function(frm) {
        updateMappedFields(frm);
    },
    custom_customiziation: function(frm) {
        updateMappedFields(frm);
    },
    custom_stocking: function(frm) {
        updateMappedFields(frm);
    },
    custom_profit_margin: function(frm) {
        updateMappedFields(frm); 
    },
    total_cost_before_margin: function(frm) {
        updatetotals(frm);
    },
    total_final_rate: function(frm) {
        updatetotals(frm);
    },
    initial_cost_in_product_currency: function(frm) {
        updateInitialCostPerUnit(frm);
    },
    exchange_rate: function(frm) {
        updateInitialCostPerUnit(frm);

    },
    custom_and_clearance: function(frm){
        calculateMargins(frm);
    },   
    bill_of_quantity: function(frm, cdt, cdn) {
        updateInitialCostPerUnit(frm, cdt, cdn);
        updatetotals(frm, cdt, cdn);
    }
});

frappe.ui.form.on("Bill of Quantity",{
    before_bill_of_quantity_remove(frm,cdt,cdn) {
        console.log("hi")
        let row = locals[cdt][cdn]
        if(row.is_component) {return}
        for (let i of frm.doc.bill_of_quantity) {
            if (row.name === i.name) {continue} 
            if (i.parent_item === row.product_code && i.is_component) {
                frappe.model.clear_doc(i.doctype,i.name)
            }
        }
        frm.refresh_field("bill_of_quantity")
        // frm.save()
    }
})
frappe.ui.form.on('Sub BOQ', {
    refresh: function (frm) {
        frm.add_custom_button(('Auto Fill'), function () {
            const selected_rows = frm.fields_dict.bill_of_quantity.grid.get_selected_children();

            if (selected_rows.length === 0) {
                frappe.msgprint(('Please select rows in the table.'));
                return;
            }

            const child_fields = Object.keys(frm.fields_dict.bill_of_quantity.grid.fields_map);
            const dialog = new frappe.ui.Dialog({
                title: __('Auto Fill Rows'),
                fields: [
                    {
                        fieldname: 'field_to_update',
                        label: 'Field to Update',
                        fieldtype: 'Select',
                        options: child_fields.join('\n'),
                        reqd: 1,
                    },
                    {
                        fieldname: 'value',
                        label: 'Value',
                        fieldtype: 'Data', // Default
                        reqd: 1,
                    },
                ],
                primary_action_label: __('Apply'),
                primary_action: async (values) => {
                    console.log("Selected field to update:", values.field_to_update);
                    console.log("Value to apply:", values.value);

                    let promises = [];
                    selected_rows.forEach((row) => {
                        if (row && row.name) {
                            console.log("Processing row:", row.name);

                            promises.push(
                                frappe.model.set_value(row.doctype, row.name, values.field_to_update, values.value)
                            );
                        }
                    });

                    try {
                        await Promise.all(promises);
                        frm.refresh_field('bill_of_quantity');
                        await frm.save();
                        frappe.msgprint(__('Rows updated and form saved successfully.'));
                    } catch (err) {
                        console.error('Failed to update rows or save the form:', err);
                        frappe.msgprint(__('An error occurred. Check the console for details.'));
                    }

                    dialog.hide();
                },
            });

            dialog.fields_dict.field_to_update.$input.on('change', function () {
                const selected_field = dialog.get_value('field_to_update');
                console.log("Selected field:", selected_field);

                const field_definition = frm.fields_dict.bill_of_quantity.grid.fields_map[selected_field];
                if (field_definition) {
                    const field_type = field_definition.fieldtype || 'Data';
                    const options = field_definition.options || '';

                    dialog.fields_dict.value.df.fieldtype = field_type;

                    if (field_type === 'Select') {
                        dialog.fields_dict.value.df.options = options;
                    } else if (field_type === 'Link') {
                        dialog.fields_dict.value.df.options = field_definition.options;
                    }

                    dialog.fields_dict.value.refresh();
                }
            });

            dialog.show();
        });
    },
});
frappe.ui.form.on('SUb BOQ', {
    refresh: function (frm) {
        // Customize the Add Row button
        frm.fields_dict['bill_of_quantity'].grid.add_custom_button('Add Multiple Rows', function () {
            frappe.prompt(
                [
                    {
                        fieldname: 'number_of_rows',
                        fieldtype: 'Int',
                        label: 'Number of Rows',
                        reqd: 1
                    }
                ],
                function (data) {
                    if (data.number_of_rows > 0) {
                        for (let i = 0; i < data.number_of_rows; i++) {
                            let new_row = frm.add_child('bill_of_quantity');
                            // Optional: Set default values for the new rows here
                            new_row.some_field = "Default Value";
                        }
                        frm.refresh_field('bill_of_quantity');
                    } else {
                        frappe.msgprint(__('Please enter a valid number greater than 0.'));
                    }
                },
                __('Add Rows'),
                __('Add')
            );
        });
    }
});


frappe.ui.form.on('Sub BOQ', {
    refresh: function (frm) {
        // Add custom button to trigger mapping
        frm.add_custom_button(__('Map to BOQ'), async function () {
            if (!frm.doc.project_name) {
                frappe.msgprint(__('Please enter a Project Name in the main document.'));
                return;
            }

            try {
                // Fetch the Lead document based on project_name
                const leadData = await frappe.db.get_value('Lead', { custom_project_name: frm.doc.project_name }, 'name');

                let leadDoc;
                if (leadData && leadData.name) {
                    // Fetch the Lead document if it exists
                    leadDoc = await frappe.model.with_doc('Lead', leadData.name);
                } else {
                    // Create a new Lead document if not found
                    leadDoc = frappe.model.get_new_doc('Lead');
                    leadDoc.custom_project_name = frm.doc.project_name;
                    leadDoc.lead_name = `Project - ${frm.doc.project_name}`;
                }

                // Map BOQ data from Main Doctype to Lead
                const leadBOQMap = {};
                leadDoc.custom_bill_of_quantity.forEach(row => {
                    leadBOQMap[row.name] = row;
                });

                frm.doc.bill_of_quantity.forEach(mainRow => {
                    let leadRow = Object.values(leadBOQMap).find(row => row.row_name === mainRow.row_name);

                    if (leadRow) {
                        // Update existing row in Lead BOQ
                        Object.keys(mainRow).forEach(key => {
                            if (key in leadRow) {
                                leadRow[key] = mainRow[key];
                            }
                        });
                    } else {
                        // Insert a new row in Lead BOQ
                        const newRow = frappe.model.add_child(leadDoc, 'custom_bill_of_quantity');
                        Object.assign(newRow, mainRow);
                    }
                });

                // Save the updated Lead document
                await frappe.db.save_doc(leadDoc);
                frappe.msgprint(__('BOQ mapping completed successfully.'));
            } catch (error) {
                console.error('Error during BOQ mapping:', error);
                frappe.msgprint(__('An error occurred while mapping BOQ.'));
            }
        });
    }
});





