
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
 

    function generateHidCode(floorLevel, roomNumber, baseCode, suffix = '') {
        let code = '';
    
        // Add floor level and room number first, with a hyphen between them if both are present
        if (floorLevel && roomNumber) {
            code += `${floorLevel}-${roomNumber}`;
        } else {
            if (floorLevel) code += `${floorLevel}`;
            if (roomNumber) code += `${roomNumber}`;
        }
    
        // Add base code next
        if (baseCode) {
            code += `-${baseCode}`;
        }
    
        // Add suffix if provided
        if (suffix) {
            code += `-${suffix}`;
        }
    
        return code;
    }
    function generateHidCodeComponent(baseCode, suffix = '') {
        return suffix ? `${baseCode}-${suffix}` : baseCode;
    }
    
    async function generateComponentHidCode(frm) {
        let lastMainProductCode = null;
        let lastMainProductProductCode = null;
        let currentSuffix = 'A';
        let floor_level = null;
        let room_number = null;
        let room_name = null;
        let area = null;
        let building_number = null;
    
        try {
            // Loop through the 'bill_of_quantity' child table in the form
            for (let idx = 0; idx < frm.doc.bill_of_quantity.length; idx++) {
                let row = frm.doc.bill_of_quantity[idx];    
                // If the row is not a component
                if (row.is_component === 0) {
                    if (!row.hid_code) {
                        lastMainProductCode = generateNewBaseCode(frm);
                        await frappe.model.set_value(row.doctype, row.name, 'hid_code', lastMainProductCode);
                    } else {
                        lastMainProductCode = row.hid_code;
                    }
                    lastMainProductProductCode = row.product_code;
                    floor_level = row.floor_level;
                    room_number = row.room_number;
                    room_name = row.room_name;
                    area = row.area;
                    building_number = row.building_number;
                    currentSuffix = 'A';
                }
                // If the row is a component and the necessary codes exist
                else if (row.is_component === 1 && lastMainProductCode && lastMainProductProductCode && !row.hid_code) {
                    let componentHidCode = generateHidCodeComponent( lastMainProductCode, currentSuffix);

                    await frappe.model.set_value(row.doctype, row.name, 'hid_code', componentHidCode);
                    await frappe.model.set_value(row.doctype, row.name, 'parent_item', lastMainProductProductCode);
                    await frappe.model.set_value(row.doctype, row.name, 'floor_level', floor_level);
                    await frappe.model.set_value(row.doctype, row.name, 'room_number', room_number);
                    await frappe.model.set_value(row.doctype, row.name, 'room_name', room_name);
                    await frappe.model.set_value(row.doctype, row.name, 'area', area);
                    await frappe.model.set_value(row.doctype, row.name, 'building_number', building_number);
                    // Increment suffix for the next component
                    currentSuffix = String.fromCharCode(currentSuffix.charCodeAt(0) + 1);
                    
                    // Optionally handle suffix beyond 'Z' if needed
                    if (currentSuffix > 'Z') {
                        currentSuffix = 'A'; // Reset to 'A' after 'Z'
                    }
                }
            }
    
            // Refresh the field after updating all rows
            frm.refresh_field('bill_of_quantity');
        } catch (error) {
            console.error("Error processing HID code generation:", error);
        }
    }
    
    

    function generateNewBaseCode(frm, floorLevel = '', roomNumber = '') {
        const mainProductCodes = frm.doc.bill_of_quantity
            .filter(row => row.is_component === 0 && row.hid_code)
            .map(row => row.hid_code);
    
        // If there are no existing codes, start from 'base_code-001'
        let baseCode = 'base_code-001';
        if (mainProductCodes.length === 0) {
            if (floorLevel) baseCode += `-${floorLevel}`;
            if (roomNumber) baseCode += `-${roomNumber}`;
            return baseCode;
        }
    
        // Extract the numeric part from the last code
        const lastCode = mainProductCodes.sort().pop();
        const [prefix, number] = lastCode.split('-');
    
        // Increment the number part and format it to three digits
        const newNumber = String(parseInt(number, 10) + 1).padStart(3, '0');
    
        baseCode = `${prefix}-${newNumber}`;
        if (floorLevel && roomNumber) {
            baseCode = `-${floorLevel}-${roomNumber}` + baseCode;
        } else {
            if (floorLevel) baseCode = `-${floorLevel}` + baseCode;
            if (roomNumber) baseCode = `-${roomNumber}` + baseCode;
        }
        
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
                const floorLevel = row.floor_level;
                const roomNumber = row.room_name;
                const formatindex = String(index).padStart(3, '0');
                if (!row.hid_code) {row.hid_code = generateHidCode(floorLevel, roomNumber, base_code, formatindex);}
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

frappe.ui.form.on('Sub BOQ', {
    refresh: function(frm) {

        frm.add_custom_button('<i class="fa fa-cogs" style="margin-right: 5px; color: blue;"></i> <b>Create - Update Items</b>', function () {
            createItemsFromBoQ(frm);
        });
    },
    
   
});
frappe.ui.form.on('Sub BOQ', {
    refresh(frm) {
        // Add the button in the child table beside the "Add Row" button
        frm.fields_dict['bill_of_quantity'].grid.add_custom_button('Add Row with Parent Data', function() {
            let row = frm.add_child('bill_of_quantity', {
                floor_level: frm.doc.floor_level,
                room_name: frm.doc.room_name,
                // Add other fields as needed
            });

            frm.refresh_field('bill_of_quantity');
        });

        // Ensure the button appears near the existing buttons
        frm.fields_dict['bill_of_quantity'].grid.custom_buttons['Add Row with Parent Data']
            .removeClass('btn-default')
            .addClass('btn-primary');
    }
});

frappe.ui.form.on('Sub BOQ', {
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

                            // Copy parent data into the child row
                            new_row.floor_level = frm.doc.floor_level;
                            new_row.room_name = frm.doc.room_name;

                            // Optional: Set other default values here
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
        frm.add_custom_button('<i class="fa fa-bolt" style="font-size: 20px;"></i> <b style="font-size: 18px;">Auto Fill</b>', function () {
            // Collect selected rows from the child table
            const selected_rows = frm.fields_dict.bill_of_quantity.grid.get_selected();
            console.log("Selected rows:", selected_rows);

            if (selected_rows.length === 0) {
                frappe.msgprint(('Please select rows in the table'));
                return;
            }

            // Get the list of fields in the child table
            const child_fields = Object.keys(frm.fields_dict.bill_of_quantity.grid.fields_map);
            console.log("Available child fields:", child_fields);

            // Create the dialog
            var me = frm;
            const dialog = new frappe.ui.Dialog({
                title: __('Auto Fill Rows'),
                fields: [
                    {
                        fieldname: 'field_to_update',
                        label: 'Field to Update',
                        fieldtype: 'Select',
                        options: child_fields.join('\n'),
                        reqd: 1,
                        // default: 'product_name',
                        onchange: () => {
                            set_value_field(dialog, me);  // Handle field updates
                        },
                    },
                    {
                        fieldname: 'value',
                        label: 'Value',
                        fieldtype: 'Data', // Default type (will dynamically change)
                        reqd: 1,
                    },
                ],
                primary_action_label: __('Apply'),
                primary_action: (values) => {
                    console.log("Field to update:", values.field_to_update);
                    console.log("Value to apply:", values.value);

                    let changes_applied = false;

                    // Loop through the selected rows and apply the value to the specified field
                    selected_rows.forEach((row) => {
                        const child_row = frm.doc.bill_of_quantity.find((r) => r.name === row);
                        console.log("Checking row:", row, child_row);

                        if (child_row) {
                            console.log("Field exists, updating:", values.field_to_update, "to", values.value);
                            child_row[values.field_to_update] = values.value;
                            changes_applied = true;
                        } else {
                            console.warn("Row not found:", row);
                        }
                    });

                    if (changes_applied) {
                        frm.refresh_field('bill_of_quantity');
                        frm.save().then(() => {
                            frappe.msgprint(__('Rows updated and form saved successfully.'));
                        });
                    } else {
                        frappe.msgprint(__('No rows were updated. Please check the field names.'));
                    }

                    dialog.hide();
                },
            });

            // Dynamically update the Value field's type based on the selected field
            dialog.fields_dict.field_to_update.$input.on('change', function () {
                const selected_field = dialog.get_value('field_to_update');
                console.log("Selected field:", selected_field);

                const field_definition = frm.fields_dict.bill_of_quantity.grid.fields_map[selected_field];
                if (field_definition) {
                    const field_type = field_definition.fieldtype || 'Data';
                    const options = field_definition.options || '';

                    console.log("Updating Value field type:", field_type);

                    // Dynamically update the field based on type
                    dialog.fields_dict.value.df.fieldtype = field_type;

                    if (field_type === 'Select') {
                        dialog.fields_dict.value.df.options = options;
                    } else if (field_type === 'Link') {
                        dialog.fields_dict.value.df.options = options;
                    }

                    dialog.fields_dict.value.refresh(); // Ensures the field type change reflects immediately
                }
            });

            dialog.show();
        });
    },
});

function set_value_field(dialogObj, frm) {
    const status_regex = /status/i;
    let field_mappings = frm.fields_dict.bill_of_quantity.grid.fields_map;
    const new_df = Object.assign({}, field_mappings[dialogObj.get_value("field_to_update")]);

    if (
        new_df.label.match(status_regex) &&
        new_df.fieldtype === "Select" &&
        !new_df.default
    ) {
        let options = [];
        if (typeof new_df.options === "string") {
            options = new_df.options.split("\n");
        }
        new_df.default = options[0] || options[1];
    }

    new_df.label = __("Value");
    delete new_df.depends_on;

    dialogObj.replace_field("value", new_df);
    dialogObj.refresh(dialogObj);
}


frappe.ui.form.on('Sub BOQ', {
    refresh: function (frm) {
        frm.add_custom_button('<i class="fa fa-map" style="margin-right: 5px; color: blue;"></i> <b>Map to BOQ</b>', function () {
            frm.trigger('map_to_lead');
        });
    },

    map_to_lead: function (frm) {
        if (!frm.doc.project_name) {
            frappe.msgprint(__('Please ensure the Project Name is filled.'));
            return;
        }

        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Lead',
                filters: { custom_project_name: frm.doc.project_name },
                fields: ['name']
            },
            callback: function (response) {
                const lead_records = response.message;

                if (!lead_records || lead_records.length === 0) {
                    frappe.msgprint(__('No Lead record found for the given Project Name.'));
                    return;
                }

                const lead_name = lead_records[0].name;

                frappe.call({
                    method: 'frappe.client.get',
                    args: { doctype: 'Lead', name: lead_name },
                    callback: function (lead_response) {
                        const lead_doc = lead_response.message;

                        if (!lead_doc.custom_bill_of_quantity) {
                            lead_doc.custom_bill_of_quantity = [];
                        }

                        let mapped_count = 0;
                        let updated_count = 0;

                        const lead_rows = lead_doc.custom_bill_of_quantity;

                        frm.doc.bill_of_quantity.forEach((row) => {
                            if (row.name) {
                                // Generate a new unique name for the row
                                const new_row_name = `${frm.doc.name}-${row.idx}-${Date.now()}`;

                                // Check if a row with this name exists in the Lead's child table
                                const existing_row = lead_rows.find(r => r.name === row.name);

                                if (existing_row) {
                                    // Update existing row if changes are found
                                    let has_changes = false;

                                    Object.keys(row).forEach((key) => {
                                        if (!["__idx", "__islocal", "__unsaved", "__deleted", "__hash", "name"].includes(key) && row[key] !== existing_row[key]) {
                                            existing_row[key] = row[key];
                                            has_changes = true;
                                        }
                                    });

                                    if (has_changes) {
                                        updated_count++;
                                    }
                                } else {
                                    // Add a new row with the updated unique name
                                    const new_row = {};
                                    Object.keys(row).forEach((key) => {
                                        if (!["__idx", "__islocal", "__unsaved", "__deleted", "__hash"].includes(key)) {
                                            new_row[key] = row[key];
                                        }
                                    });
                                    new_row.name = new_row_name;
                                    new_row.idx = lead_rows.length + 1; // Assign a new index
                                    lead_rows.push(new_row);
                                    mapped_count++;
                                }
                            }
                        });

                        if (mapped_count > 0 || updated_count > 0) {
                            frappe.call({
                                method: 'frappe.client.save',
                                args: { doc: lead_doc },
                                callback: function () {
                                    frappe.msgprint(`${mapped_count} new rows mapped and ${updated_count} rows updated in Project: ${custom_project_name_actual}`);

                                    // Save Sub BOQ to preserve state
                                    frm.save_or_update({
                                        callback: function () {
                                            frappe.msgprint(__('Sub BOQ saved successfully to preserve the table state.'));
                                        },
                                        error: function () {
                                            frappe.msgprint(__('Error while saving Sub BOQ.'));
                                        }
                                    });
                                },
                                error: function (err) {
                                    frappe.msgprint(__('Error while saving the Lead.'));
                                    console.error(err);
                                }
                            });
                        } else {
                            frappe.msgprint(__('No rows were mapped or updated.'));
                        }
                    },
                    error: function (err) {
                        frappe.msgprint(__('Error fetching Lead details.'));
                        console.error(err);
                    }
                });
            },
            error: function (err) {
                frappe.msgprint(__('Error fetching Lead list.'));
                console.error(err);
            }
        });
    }
});

