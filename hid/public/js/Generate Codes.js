


async function createItemsFromBoQ(frm) {
    console.log("createItemsFromBoQ function called");
    let itemsCreated = 0;
    let itemsSkipped = 0;
    let itemsUpdated = 0;
    const processedItemCodes = new Set();
    
    const productCountMap = new Map();

    async function checkItemExists(product_code) {
        try {
            return await frappe.db.exists('Item', product_code);
        } catch (err) {
            console.error(`Error checking item existence with hid_code "${hid_code}":`, err);
            throw err;
        }
    }

    async function getItem(product_code) {
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
                updateRowInForm(frm, item_code);
            } else {
                handleError(`Error updating item with hid_code "${item_code}":`, response.message);
            }
        } catch (err) {
            handleError(`Error updating item with hid_code "${item_code}":`, err);
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
            updateRowInForm(frm, new_item.item_code);
        } catch (err) {
            console.error(`Error creating item with hid_code "${itemData.item_code}":`, err);
            itemsSkipped++;
            frappe.msgprint(`Error creating item with hid_code "${itemData.item_code}": ${err.message || 'Unknown error'}`);
        }
    }

    async function generateComponentHidCode(frm) {
        let lastMainProductCode = null; // Store the most recent base code for is_component == 0
        let lastMainProductProductCode = null; // Store the corresponding product code for is_component == 0
        let currentSuffix = 'A'; // Initialize the suffix for components
    
        try {
            // Loop through all rows to generate HID codes
            for (let idx = 0; idx < frm.doc.custom_bill_of_quantity.length; idx++) {
                let row = frm.doc.custom_bill_of_quantity[idx];
    
                if (row.is_component == 0) {
                    // It's a main product
                    if (!row.hid_code) {
                        lastMainProductCode = generateNewBaseCode(frm); // Generate the main product code
                        await frappe.model.set_value(row.doctype, row.name, 'hid_code', lastMainProductCode); // Update HID code in the grid
                    } else {
                        lastMainProductCode = row.hid_code; // Use the existing main product code
                    }
    
                    lastMainProductProductCode = row.product_code; // Capture the main product's product_code
                    currentSuffix = 'A'; // Reset suffix for components
    
                } else if (row.is_component == 1 && lastMainProductCode && lastMainProductProductCode) {
                    // It's a component
                    let componentHidCode = `${lastMainProductCode}-${currentSuffix}`;
                    await frappe.model.set_value(row.doctype, row.name, 'hid_code', componentHidCode); // Update HID code in the grid
    
                    // Update the parent_item field with the product_code of the corresponding main product
                    await frappe.model.set_value(row.doctype, row.name, 'parent_item', lastMainProductProductCode); // Set the parent_item field
    
                    // Increment the suffix for the next component
                    currentSuffix = String.fromCharCode(currentSuffix.charCodeAt(0) + 1);
                }
            }
    
            // Refresh the form only after all updates have been applied
            frm.refresh_field('custom_bill_of_quantity');
    
        } catch (error) {
            console.error("Error processing HID code generation:", error);
        }
    }
    
    
    // Helper function to generate a new base code for the main product
    function generateNewBaseCode(frm) {
        const mainProductCodes = frm.doc.custom_bill_of_quantity
            .filter(row => row.is_component == 0 && row.hid_code)
            .map(row => row.hid_code);
    
        if (mainProductCodes.length === 0) {
            return 'SS-001'; // Starting base code
        }
    
        const lastCode = mainProductCodes.sort().pop();
        const [prefix, number] = lastCode.split('-');
        const newNumber = String(parseInt(number) + 1).padStart(3, '0');
        return `${prefix}-${newNumber}`;
    }

    // Generate HID code function
    function generateHidCode(base_code, index) {
        // Generate a unique HID code based on the base code and index
        return `${base_code}-${index}`;
    }
    
    // Main loop to process all rows in custom_bill_of_quantity
    for (const row of frm.doc.custom_bill_of_quantity) {
        if (row.product_name && row.uom) {
            if (!productCountMap.has(row.product_name)) {
                productCountMap.set(row.product_name, 0);
            }

            const index = productCountMap.get(row.product_name) + 1;
            productCountMap.set(row.product_name, index);

            // Generate HID code
            if (row.is_component) {
                await generateComponentHidCode(frm);
            } else {
                // Check if the form is in edit mode
                const base_code = frm.is_new() ? row.product_name : row.base_code; // Use base_code if editing
                row.hid_code = generateHidCode(base_code, index);
            }

            if (processedItemCodes.has(row.hid_code)) {
                itemsSkipped++;
                continue;
            }

            try {
                const exists = await checkItemExists(row.product_code);
                const itemData = createItemData(row, frm); 

                if (exists) {
                    const existingItem = await getItem(row.product_code);
                    if (hasDifferences(existingItem, itemData)) {
                        await updateItem(row.product_code, itemData);
                    } else {
                        itemsSkipped++;
                        console.log(`No changes detected for item with product_code "${row.product_code}".`);
                    }
                } else {
                    await createItem(itemData);
                }
            } catch (err) {
                console.error(`Error processing item with product_code "${row.product_code}":`, err);
                itemsSkipped++;
            }
        }
    }

    // Save the document after processing all items
    try {
        await frm.save();
        frappe.msgprint(`Items creation process completed. Created: ${itemsCreated}, Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}`);
    } catch (err) {
        console.error('Error saving document:', err);
        frappe.msgprint('There was an issue saving the document.');
    }
}

// Helper function to create item data
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
        custom_parent_item:row.parent_item
    };
}

// Function to check differences between existing item and new data
function hasDifferences(existingItem, newData) {
    return Object.keys(newData).some(key => existingItem[key] !== newData[key]);
}

async function updateRowInForm(frm, item_code) {
     async function getItem(product_code) {
        try {
            return await frappe.db.get_doc('Item', product_code);
        } catch (err) {
            console.error(`Error retrieving item with product_code "${product_code}":`, err);
            throw err;
        }
    }
    // Retrieve the item data for the created or updated item
    const existingItem = await getItem(item_code);

    // Update each row in the custom_bill_of_quantity with the new values
    for (let idx = 0; idx < frm.doc.custom_bill_of_quantity.length; idx++) {
        const row = frm.doc.custom_bill_of_quantity[idx];
        if (row.name === existingItem.custom_boq_item) {
            frappe.model.set_value(row.doctype, row.name, 'product_code', existingItem.item_code); // Set the product_code
            frappe.model.set_value(row.doctype, row.name, 'is_created', 1); // Set is_created to 1
            break; // Exit the loop after updating the matching row
        }
    }
}

// async function createItemsFromBoQ(frm) {
//     console.log("createItemsFromBoQ function called");
//     let itemsCreated = 0;
//     let itemsSkipped = 0;
//     let itemsUpdated = 0;
//     const processedItemCodes = new Set();
    
//     const productCountMap = new Map();

//     async function checkItemExists(hid_code) {
//         try {
//             return await frappe.db.exists('Item', hid_code);
//         } catch (err) {
//             console.error(`Error checking item existence with hid_code "${hid_code}":`, err);
//             throw err;
//         }
//     }

//     async function getItem(hid_code) {
//         try {
//             return await frappe.db.get_doc('Item', hid_code);
//         } catch (err) {
//             console.error(`Error retrieving item with hid_code "${hid_code}":`, err);
//             throw err;
//         }
//     }

//     async function updateItem(item_code, itemData) {
//         console.log("updateItem function called for", item_code);
//         try {
//             const response = await frappe.call({
//                 method: 'frappe.client.set_value',
//                 args: {
//                     doctype: 'Item',
//                     name: item_code,
//                     fieldname: itemData
//                 }
//             });

//             if (!response.exc) {
//                 itemsUpdated++;
//                 processedItemCodes.add(item_code);
//                 updateRowInForm(frm, item_code);
//             } else {
//                 handleError(`Error updating item with hid_code "${item_code}":`, response.message);
//             }
//         } catch (err) {
//             handleError(`Error updating item with hid_code "${item_code}":`, err);
//         }
//     }

//     async function createItem(itemData) {
//         console.log("createItem function called for", itemData.item_code);
//         const item_doc = frappe.model.get_new_doc('Item');
//         Object.assign(item_doc, itemData);

//         try {
//             const new_item = await frappe.db.insert(item_doc);
//             itemsCreated++;
//             processedItemCodes.add(itemData.item_code);
//             updateRowInForm(frm, new_item.item_code);
//         } catch (err) {
//             console.error(`Error creating item with hid_code "${itemData.item_code}":`, err);
//             itemsSkipped++;
//             frappe.msgprint(`Error creating item with hid_code "${itemData.item_code}": ${err.message || 'Unknown error'}`);
//         }
//     }

//     async function generateComponentHidCode(frm) {
//         let lastMainProductCode = null; // Store the most recent base code for is_component == 0
//         let lastMainProductProductCode = null; // Store the corresponding product code for is_component == 0
//         let currentSuffix = 'A'; // Initialize the suffix for components
    
//         try {
//             // Loop through all rows to generate HID codes
//             for (let idx = 0; idx < frm.doc.custom_bill_of_quantity.length; idx++) {
//                 let row = frm.doc.custom_bill_of_quantity[idx];
    
//                 if (row.is_component == 0) {
//                     // It's a main product
//                     if (!row.hid_code) {
//                         lastMainProductCode = generateNewBaseCode(frm); // Generate the main product code
//                         await frappe.model.set_value(row.doctype, row.name, 'hid_code', lastMainProductCode); // Update HID code in the grid
//                     } else {
//                         lastMainProductCode = row.hid_code; // Use the existing main product code
//                     }
    
//                     lastMainProductProductCode = row.hid_code; // Capture the main product's product_code
//                     currentSuffix = 'A'; // Reset suffix for components
    
//                 } else if (row.is_component == 1 && lastMainProductCode && lastMainProductProductCode) {
//                     // It's a component
//                     let componentHidCode = `${lastMainProductCode}-${currentSuffix}`;
//                     await frappe.model.set_value(row.doctype, row.name, 'hid_code', componentHidCode); // Update HID code in the grid
    
//                     // Update the parent_item field with the product_code of the corresponding main product
//                     await frappe.model.set_value(row.doctype, row.name, 'parent_item', lastMainProductProductCode); // Set the parent_item field
    
//                     // Increment the suffix for the next component
//                     currentSuffix = String.fromCharCode(currentSuffix.charCodeAt(0) + 1);
//                 }
//             }
    
//             // Refresh the form only after all updates have been applied
//             frm.refresh_field('custom_bill_of_quantity');
    
//         } catch (error) {
//             console.error("Error processing HID code generation:", error);
//         }
//     }
    
    
//     // Helper function to generate a new base code for the main product
//     function generateNewBaseCode(frm) {
//         const mainProductCodes = frm.doc.custom_bill_of_quantity
//             .filter(row => row.is_component == 0 && row.hid_code)
//             .map(row => row.hid_code);
    
//         if (mainProductCodes.length === 0) {
//             return 'SS-001'; // Starting base code
//         }
    
//         const lastCode = mainProductCodes.sort().pop();
//         const [prefix, number] = lastCode.split('-');
//         const newNumber = String(parseInt(number) + 1).padStart(3, '0');
//         return `${prefix}-${newNumber}`;
//     }

//     // Generate HID code function
//     function generateHidCode(base_code, index) {
//         // Generate a unique HID code based on the base code and index
//         return `${base_code}-${index}`;
//     }
    
//     // Main loop to process all rows in custom_bill_of_quantity
//     for (const row of frm.doc.custom_bill_of_quantity) {
//         if (row.product_name && row.uom) {
//             if (!productCountMap.has(row.product_name)) {
//                 productCountMap.set(row.product_name, 0);
//             }

//             const index = productCountMap.get(row.product_name) + 1;
//             productCountMap.set(row.product_name, index);

//             // Generate HID code
//             if (row.is_component) {
//                 await generateComponentHidCode(frm);
//             } else {
//                 // Check if the form is in edit mode
//                 const base_code = frm.is_new() ? row.product_name : row.base_code; // Use base_code if editing
//                 row.hid_code = generateHidCode(base_code, index);
//             }

//             if (processedItemCodes.has(row.hid_code)) {
//                 itemsSkipped++;
//                 continue;
//             }

//             try {
//                 const exists = await checkItemExists(row.hid_code);
//                 const itemData = createItemData(row, frm); 

//                 if (exists) {
//                     const existingItem = await getItem(row.hid_code);
//                     if (hasDifferences(existingItem, itemData)) {
//                         await updateItem(row.hid_code, itemData);
//                     } else {
//                         itemsSkipped++;
//                         console.log(`No changes detected for item with hid_code "${row.hid_code}".`);
//                     }
//                 } else {
//                     await createItem(itemData);
//                 }
//             } catch (err) {
//                 console.error(`Error processing item with hid_code "${row.hid_code}":`, err);
//                 itemsSkipped++;
//             }
//         }
//     }

//     // Save the document after processing all items
//     try {
//         await frm.save();
//         frappe.msgprint(`Items creation process completed. Created: ${itemsCreated}, Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}`);
//     } catch (err) {
//         console.error('Error saving document:', err);
//         frappe.msgprint('There was an issue saving the document.');
//     }
// }

// // Helper function to create item data
// function createItemData(row, frm) {
//     return {
//         item_code: row.hid_code,
//         item_name: row.product_name,
//         stock_uom: row.uom,
//         item_group: row.product_code_category,
//         custom_item_link: row.item_link,
//         custom_building_number: row.building_number,
//         custom_area: row.area,
//         custom_document: row.document,
//         custom_room_name: row.room_name,
//         custom_room_number: row.room_number,
//         custom_floor_level: row.floor_level,
//         custom_supplier: row.supplier,
//         custom_supplier_part_number: row.supplier_part_number,
//         custom_diemension: row.diemensions,
//         custom_describition: row.descripition,
//         custom_boq: frm.doc.name,
//         custom_desugner_item_code: row.designer_item_code,
//         custom_reference_document: row.refreference_document,
//         custom_specification_details: row.specification_details,
//         image: row.attach_image_wjpb,
//         custom_attach: row.attach_secondary_image,
//         custom_date_of_pacage: row.date_of_packge,
//         custom_status: row.status,
//         custom_boq_item: row.name
//     };
// }

// // Function to check differences between existing item and new data
// function hasDifferences(existingItem, newData) {
//     return Object.keys(newData).some(key => existingItem[key] !== newData[key]);
// }

// // Update row in the form
// function updateRowInForm(frm, item_code) {
//     frm.doc.custom_bill_of_quantity.forEach(row => {
//         if (row.hid_code === item_code) {
//             frappe.model.set_value(row.doctype, row.name, 'product_code', item);
//             frappe.model.set_value(row.doctype, row.name, 'is_created', 1);
//         }
//     });
// }





// Function to create a Material Request
async function createMaterialRequest(frm) {
    console.log("createMaterialRequest function called");
    try {
        const new_doc = frappe.model.get_new_doc('Material Request');
        new_doc.material_request_type = 'Purchase';
        new_doc.transaction_date = frappe.datetime.nowdate();
        new_doc.schedule_date = frappe.datetime.nowdate();
        new_doc.custom_from_bill_of_quantity = frm.doc.name;
        new_doc.set_warehouse = frm.doc.custom_warhouse;
        new_doc.custom_project_name = frm.doc.custom_project_name;
        new_doc.custom_project_number = frm.doc.custom_project_id;

        frm.doc.custom_bill_of_quantity.forEach(row => {
            const item = frappe.model.add_child(new_doc, 'Material Request Item', 'items');
            item.item_code = row.product_code;
            item.item_name = row.product_name;
            item.stock_uom = row.uom;
            item.qty = row.qty;
            item.schedule_date = frappe.datetime.nowdate();
            item.custom_supplier = row.supplier;
            item.warehouse = frm.doc.custom_warhouse;
            item.custom_and_clearance = row.custom_and_clearance;
            item.logistics = row.logistics;
            item.additional_cost = row.additional_cost;
            item.oh = row.oh;
            item.profit_margin = row.profit_margin;
            item.initial_cost = row.initial_cost;
            item.initial_cost_per_unit = row.initial_cost_per_unit;
            item.initial_cost_in_product_currency = row.initial_cost_in_product_currency;
            item.exchange_rate = row.exchange_rate;
            item.cost_before_margin = row.cost_before_margin;
            item.final_rate = row.final_rate;
            item.custom_from_bill_of_quantity = frm.doc.name;
            item.custom_from_bill_of_quantity_item = row.name;

            // Add additional fields here
            item.custom_field_1 = row.custom_field_1; // Example of additional field
            item.custom_field_2 = row.custom_field_2; // Example of additional field
        });

        const doc = await frappe.db.insert(new_doc);
        frappe.set_route('Form', 'Material Request', doc.name);
        // Update Lead Doctype with new stage
        frm.set_value('custom_lead_stage', 'Procurment Stage');
        await frm.save();

    } catch (err) {
        console.error('Error creating Material Request:', err);
        frappe.msgprint(__('There was an issue creating the Material Request.'));
    }
}

// Function to update margins for all rows in custom_bill_of_quantity
function calculateMargins(frm, cdt, cdn) {
    console.log("calculateMargins function called for", cdt, cdn);
    const row = locals[cdt][cdn];
    
    // const initial_cost_per_unit = parseFloat(row.initial_cost_per_unit) || 0;
    const initial_cost_in_product_currency = parseFloat(row.initial_cost_in_product_currency) || 0;
    const exchange_rate = parseFloat(row.exchange_rate) || 1;
    const custom_and_clearance = parseFloat(row.custom_and_clearnce) || 0;
    const additionalCost = parseFloat(row.additional_cost) || 0;
    const oh = parseFloat(row.oh) || 0;
    const logistics = parseFloat(row.logisitics) || 0;
    const customiziation = parseFloat(row.customiziation) || 0;
    const stocking = parseFloat(row.stocking) || 0;
    const installation = parseFloat(row.installation) || 0;
    const shipping = parseFloat(row.shipping) || 0;
    const profitMargin = parseFloat(row.profit_margin) || 0;
    const initial_cost_per_unit = (initial_cost_in_product_currency * exchange_rate); 
    const custom_and_clearance_cost = (initial_cost_per_unit * custom_and_clearance) / 100;
    const additionalCost_value = (initial_cost_per_unit * additionalCost) / 100;
    const oh_cost = (initial_cost_per_unit * oh) / 100;
    const logistics_cost = (initial_cost_per_unit * logistics) / 100;
    const customiziation_cost = (initial_cost_per_unit * customiziation) / 100;
    const stocking_cost = (initial_cost_per_unit * stocking) / 100;
    const installation_Value = (initial_cost_per_unit * installation) / 100;
    const shipping_value = (initial_cost_per_unit * shipping) / 100;

    const totalAdditionalCosts = custom_and_clearance_cost + additionalCost_value + oh_cost + logistics_cost + customiziation_cost + stocking_cost + installation_Value + shipping_value;
    const finalCost = initial_cost_per_unit + totalAdditionalCosts;


    const margin = finalCost * (profitMargin / 100);
    const finalRate = finalCost + margin;

    const roundedFinalCost = finalCost.toFixed(2);
    const roundedFinalRate = finalRate.toFixed(2);

    frappe.model.set_value(cdt, cdn, 'cost_before_margin', roundedFinalCost);
    frappe.model.set_value(cdt, cdn, 'final_rate', roundedFinalRate);
}

// Function to update field values in child table based on parent form field changes
const fieldMappings = {
    'custom_custom_and_clearnce': 'custom_and_clearnce',  // Conditional update
    'custom_logistics': 'logisitics',                      // Unconditional update
    'custom_aditional_cost': 'additional_cost',           // Unconditional update
    'custom_oh': 'oh',                                    // Unconditional update
    'custom_customiziation': 'customiziation',            // Unconditional update
    'custom_stocking': 'stocking',                        // Unconditional update
    'custom_shipping' : 'shipping',                       //  Conditional update
    'custom_installation_' : 'installation' ,                      // Unconditional update
    'custom_profit_margin': 'profit_margin'               // Unconditional update
    // Add more mappings as needed
};

// Function to update fields in child table based on parent document field changes
function updateChildTableField(frm, parentField, childField, conditionalUpdate = false) {
    console.log(`Updating child table field: ${childField} based on parent field: ${parentField}`);
    frm.doc.custom_bill_of_quantity.forEach(row => {
        if (!conditionalUpdate || (conditionalUpdate && row.currency !== 'SAR')) {
            frappe.model.set_value(row.doctype, row.name, childField, frm.doc[parentField]);
        }
    });
}

// Function to update mapped fields
function updateMappedFields(frm) {
    Object.entries(fieldMappings).forEach(([parentField, childField]) => {
        // Apply the currency condition only for 'custom_custom_and_clearnce' field
        const conditionalUpdate = (parentField === 'custom_custom_and_clearnce' || parentField === 'custom_shipping');
        updateChildTableField(frm, parentField, childField, conditionalUpdate);
    });
}


// Function to update initial cost per unit for the row
function updateInitialCostPerUnit(frm, cdt, cdn) {
    console.log("updateInitialCostPerUnit function called");
    const row = locals[cdt][cdn];
    const initial_cost_in_product_currency = parseFloat(row.initial_cost_in_product_currency) || 0;
    const exchange_rate = parseFloat(row.exchange_rate) || 1;
    const initial_cost_total = parseFloat(row.initial_cost) || 0;
    const Quantity = parseFloat(row.qty) || 0;
    // const initial_cost_per_unit = parseFloat(row.initial_cost_per_unit) || 0;

    // if (cost_before_margin > 0) {
    const initial_cost = (initial_cost_in_product_currency * exchange_rate)
    const initial_cost_value = (initial_cost_total * Quantity)
    frappe.model.set_value(cdt, cdn, 'initial_cost_per_unit', initial_cost.toFixed(2));
    frappe.model.set_value(cdt, cdn, 'initial_cost' , initial_cost_value.toFixed(2));
    }
// }

// Function to update totals
function updatetotals(frm) {
    console.log("updatetotals function called");
    let total_cost_before_margin = 0;
    let total_final_rate = 0;

    frm.doc.custom_bill_of_quantity.forEach(row => {
        total_cost_before_margin += parseFloat(row.cost_before_margin) || 0;
        total_final_rate += parseFloat(row.final_rate) || 0;
    });

    frappe.model.set_value(frm.doctype, frm.docname, 'total_cost_before_margin', total_cost_before_margin.toFixed(2));
    frappe.model.set_value(frm.doctype, frm.docname, 'total_final_rate', total_final_rate.toFixed(2));
}

// Attach event handlers
frappe.ui.form.on('Lead', {
    refresh: function(frm) {
        frm.add_custom_button(__('Update Margins'), function() {
            frm.doc.custom_bill_of_quantity.forEach(row => {
                calculateMargins(frm, row.doctype, row.name);
            });
            frm.save();
        });
        
        frm.add_custom_button(__('Initiate Pricing Request'), function() {
            createMaterialRequest(frm);
        });

        frm.add_custom_button(__('Create - Update Items'), function() {
            createItemsFromBoQ(frm);
        });
    },
    before_save: function(frm) {
        console.log("before_save event triggered");
        frm.doc.custom_bill_of_quantity.forEach(row => {
            calculateMargins(frm, row.doctype, row.name);
            updateInitialCostPerUnit(frm, row.doctype, row.name);
        });
        updatetotals(frm);
        updateMappedFields(frm);
    },
    custom_update_margin: function(frm) {
        console.log("custom_update_margin event triggered");
        frm.doc.custom_bill_of_quantity.forEach(row => {
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
    custom_bill_of_quantity_add: function(frm, cdt, cdn) {
        updateInitialCostPerUnit(frm, cdt, cdn);
        updatetotals(frm, cdt, cdn);
    }
});
