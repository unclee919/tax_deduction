
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
 

    // async function generateComponentHidCode(frm) {
    //     let lastMainProductCode = null;
    //     let lastMainProductProductCode = null;
    //     let currentSuffix = 'A';
    //     let floor_level = null;
    //     let room_number = null;
    //     let room_name = null;
    //     let area = null;
    //     let building_number = null;


    //     try {
    //         for (let idx = 0; idx < frm.doc.bill_of_quantity.length; idx++) {
    //             let row = frm.doc.bill_of_quantity[idx];

    //             if (row.is_component === 0) {
    //                 if (!row.hid_code) {
    //                     lastMainProductCode = generateNewBaseCode(frm);
    //                     await frappe.model.set_value(row.doctype, row.name, 'hid_code', lastMainProductCode);
    //                 } else {
    //                     lastMainProductCode = row.hid_code;
    //                 }

    //                 lastMainProductProductCode = row.product_code;
    //                 floor_level = row.floor_level;
    //                 room_number = row.room_number;
    //                 room_name = row.room_name;
    //                 area = row.area;
    //                 building_number = row.building_number;
    //                 currentSuffix = 'A';
    //             } else if (row.is_component === 1 && lastMainProductCode && lastMainProductProductCode && !row.hid_code) {
    //                 let componentHidCode = generateHidCode(lastMainProductCode, currentSuffix);
    //                 await frappe.model.set_value(row.doctype, row.name, 'hid_code', componentHidCode);
    //                 await frappe.model.set_value(row.doctype, row.name, 'parent_item', lastMainProductProductCode);
    //                 await frappe.model.set_value(row.doctype, row.name, 'floor_level', floor_level);
    //                 await frappe.model.set_value(row.doctype, row.name, 'room_number', room_number);
    //                await frappe.model.set_value(row.doctype, row.name, 'room_name', room_name);
    //                 await frappe.model.set_value(row.doctype, row.name, 'area', area);
    //                 await frappe.model.set_value(row.doctype, row.name, 'building_number', building_number);
    //                 // await frappe.model.set_value(row.doctype, row.name, 'parent_item', lastMainProductProductCode);
    //                 // await frappe.model.set_value(row.doctype, row.name, 'parent_item', lastMainProductProductCode);
    //                 currentSuffix = String.fromCharCode(currentSuffix.charCodeAt(0) + 1);
    //             }
    //         }

    //         frm.refresh_field('bill_of_quantity');
    //     } catch (error) {
    //         console.error("Error processing HID code generation:", error);
    //     }
    // }
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
    
    
    async function generateComponentHidCode(frm) {
        let lastMainProductCode = null;
        let lastMainProductProductCode = null;
        let currentSuffix = 'A';
        let floorLevel = null;
        let roomNumber = null;
    
        try {
            // Loop through the 'bill_of_quantity' child table in the form
            for (let idx = 0; idx < frm.doc.bill_of_quantity.length; idx++) {
                let row = frm.doc.bill_of_quantity[idx];
                floorLevel = row.floor_level || null;  // Use the row's floor_level if available
                roomNumber = row.room_name || null;    // Use the row's room_number if available
    
                // If the row is not a component
                if (row.is_component === 0) {
                    if (!row.hid_code) {
                        lastMainProductCode = generateNewBaseCode(frm, floorLevel, roomNumber);
                        await frappe.model.set_value(row.doctype, row.name, 'hid_code', lastMainProductCode);
                    } else {
                        lastMainProductCode = row.hid_code;
                    }
    
                    lastMainProductProductCode = row.product_code;
                    currentSuffix = 'A'; // Reset suffix to 'A' for a new main product
                }
                // If the row is a component and the necessary codes exist
                else if (row.is_component === 1 && lastMainProductCode && lastMainProductProductCode && !row.hid_code) {
                    let componentHidCode = generateHidCode(floorLevel, roomNumber, lastMainProductCode, currentSuffix);

                    await frappe.model.set_value(row.doctype, row.name, 'hid_code', componentHidCode);
                    await frappe.model.set_value(row.doctype, row.name, 'parent_item', lastMainProductProductCode);
    
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

async function createMaterialRequest(frm) {
    console.log("createMaterialRequest function called");

    try {
        // Validate that all rows in bill_of_quantity have a valid supplier
        for (const row of frm.doc.bill_of_quantity) {
            if (!row.supplier) {
                frappe.msgprint(__(`The supplier in row number'${row.idx}' is invalid or disabled. Please correct it.`));
                throw new Error('Validation failed: Missing supplier.');
            }

            const supplier_doc = await frappe.db.get_doc('Supplier', row.supplier);
            if (!supplier_doc || supplier_doc.disabled) {
                frappe.msgprint(__(`The supplier name '${row.supplier}',in row number'${row.idx}' is invalid or disabled. Please correct it.`));
                throw new Error(`Validation failed: Supplier '${row.supplier}' is invalid or disabled.`);
            }
        }

        // Proceed with Material Request creation
        const new_doc = frappe.model.get_new_doc('Material Request');
        new_doc.material_request_type = 'Purchase';
        new_doc.transaction_date = frappe.datetime.nowdate();
        new_doc.schedule_date = frappe.datetime.nowdate();
        new_doc.custom_from_bill_of_quantity = frm.doc.name;
        new_doc.set_warehouse = frm.doc.custom_warhouse;
        new_doc.custom_project_name = frm.doc.custom_project_name;
        new_doc.custom_project_number = frm.doc.custom_project_id;

        frm.doc.bill_of_quantity.forEach(row => {
            const item = frappe.model.add_child(new_doc, 'Material Request Item', 'items');
            item.item_code = row.product_code;
            item.item_name = row.product_name;
            item.stock_uom = row.uom;
            item.qty = row.qty;
            item.custom_hid_code = row.hid_code;
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
            item.image = row.attach_image_wjpb,
            item.custom_primary_image = row.image_give,
            item.custom_supplier_part_no = row.supplier_part_number,
            item.custom_dimension = row.diemensions,
            item.custom_item_link = row.item_link,
            item.custom_supplier_name = row.supplier_name,


            // Add additional fields here
            item.custom_field_1 = row.custom_field_1; // Example of additional field
            item.custom_field_2 = row.custom_field_2; // Example of additional field
        });

        const doc = await frappe.db.insert(new_doc);
        frappe.set_route('Form', 'Material Request', doc.name);

        // Update Sub BOQ Doctype with new stage
        frm.set_value('custom_lead_stage', 'Procurment Stage');
        await frm.save();
    } catch (err) {
        console.error('Error creating Material Request:', err);
        frappe.msgprint(__('There was an issue creating the Material Request.'));
    }
}

// Function to update margins for all rows in bill_of_quantity
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
    frm.doc.bill_of_quantity.forEach(row => {
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

    frm.doc.bill_of_quantity.forEach(row => {
        total_cost_before_margin += parseFloat(row.cost_before_margin) || 0;
        total_final_rate += parseFloat(row.final_rate) || 0;
    });

    frappe.model.set_value(frm.doctype, frm.docname, 'total_cost_before_margin', total_cost_before_margin.toFixed(2));
    frappe.model.set_value(frm.doctype, frm.docname, 'total_final_rate', total_final_rate.toFixed(2));
}

// Attach event handlers
frappe.ui.form.on('Sub BOQ', {
    refresh: function(frm) {
        frm.add_custom_button(__('Update Margins'), function() {
            frm.doc.bill_of_quantity.forEach(row => {
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
        frm.doc.bill_of_quantity.forEach(row => {
            calculateMargins(frm, row.doctype, row.name);
            updateInitialCostPerUnit(frm, row.doctype, row.name);
        });
        updatetotals(frm);
        updateMappedFields(frm);
        
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
    custom_bill_of_quantity_add: function(frm, cdt, cdn) {
        updateInitialCostPerUnit(frm, cdt, cdn);
        updatetotals(frm, cdt, cdn);
    }
});



frappe.ui.form.on('Sub BOQ', {
    refresh: function (frm) {
        const autoSaveInterval = 15 * 60 * 1000; // 5 minutes in milliseconds
        let timeRemaining = autoSaveInterval / 1000; // in seconds

        // Set auto-save interval if it's not set already
        if (!frm.auto_save_interval) {
            frm.auto_save_interval = setInterval(function () {
                if (!frm.is_dirty()) return;
                frm.save()
                    .then(() => frappe.show_alert({ message: 'Auto-saved successfully!', indicator: 'green' }))
                    .catch(err => console.error('Auto-save failed:', err));
            }, autoSaveInterval);
        }

        // Initialize the countdown in the header only once
        if (!frm.countdown_displayed) {
            frm.countdown_displayed = true;

            // Add countdown alert in the header (before tabs)
            frm.dashboard.set_headline_alert(`<div id="auto-save-timer">Auto-saving in: 05:00</div>`, 'yellow');
        }

        // Countdown logic: update the countdown every second
        if (!frm.countdown_interval) {
            frm.countdown_interval = setInterval(function () {
                timeRemaining--;

                // Format the remaining time as mm:ss
                let minutes = Math.floor(timeRemaining / 60);
                let seconds = timeRemaining % 60;
                minutes = minutes < 10 ? `0${minutes}` : minutes;
                seconds = seconds < 10 ? `0${seconds}` : seconds;

                // Update the existing countdown in the header
                document.getElementById("auto-save-timer").innerText = `Auto-saving in: ${minutes}:${seconds}`;

                if (timeRemaining <= 0) {
                    timeRemaining = autoSaveInterval / 1000; // Reset timer when it reaches 0
                }
            }, 1000); // Update every second
        }
    },

    on_unload: function (frm) {
        // Clear intervals when the form is unloaded
        if (frm.auto_save_interval) clearInterval(frm.auto_save_interval);
        if (frm.countdown_interval) clearInterval(frm.countdown_interval);
    }
});

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
// Function to handle row addition in the child table
frappe.ui.form.on('Sub BOQ', {
    refresh(frm) {
        console.log('Form Refreshed');
    },

    onload(frm) {
        // Log the form load for confirmation
        console.log('Form Loaded');
    }
});

frappe.ui.form.on('Sub BOQ', {
    // Trigger when a new row is added in the 'bill_of_quantity' child table
    bill_of_quantity_add(frm, cdt, cdn) {
        console.log('New Row Added in Bill of Quantity');
        
        // Get the current row data
        let row = locals[cdt][cdn];

        // Get values from the parent form
        let mainField1Value = frm.doc.floor_level;  // Assuming floor_level is a field in the main form
        let mainField2Value = frm.doc.room_name;    // Assuming room_name is another field in the main form

        // Set the values in the new row
        frappe.model.set_value(cdt, cdn, 'floor_level', mainField1Value);  // Set floor_level in the child row
        frappe.model.set_value(cdt, cdn, 'room_name', mainField2Value);    // Set room_name in the child row

        // Refresh the child table field to ensure UI is updated
        frm.refresh_field('bill_of_quantity');
    }
});

frappe.ui.form.on('Sub BOQ', {
    refresh: function(frm) {
        // Add a custom button directly to the header
        frm.add_custom_button(__('Map to Lead'), function() {
            frm.trigger('map_to_lead'); // Trigger the mapping function
        });

        // Display the button only when project_name is filled
        if (!frm.doc.project_name) {
            frm.remove_custom_button(__('Map to Lead'));
        }
    },

    map_to_lead: function(frm) {
        if (!frm.doc.project_name) {
            frappe.msgprint(__('Please ensure the Project Name is filled.'));
            return;
        }

        // Fetch Lead record based on custom_project_name and project_name
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Lead',
                filters: {
                    custom_project_name: frm.doc.project_name,  // Match with custom_project_name in Lead
                },
                fields: ['name', 'custom_bill_of_quantity']
            },
            callback: function(response) {
                const lead_records = response.message;
                if (lead_records.length === 0) {
                    frappe.msgprint(__('No Lead record found for the given Project Name.'));
                    return;
                }

                const lead_name = lead_records[0].name;

                // Fetch the full Lead record to update
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Lead',
                        name: lead_name
                    },
                    callback: function(lead_response) {
                        const lead_doc = lead_response.message;

                        // Initialize a set to keep track of existing rows in Lead's child table
                        const existing_rows = lead_doc.custom_bill_of_quantity || [];
                        const existing_product_codes = new Set(existing_rows.map(row => row.product_code));

                        // Loop through the rows in Sub BOQ and append them to Lead's child table if not already present
                        frm.doc.bill_of_quantity.forEach(row => {
                            // Only append the row if its product_code is not already in Lead's child table
                            if (!existing_product_codes.has(row.product_code)) {
                                const new_row = {};
                                for (const field in row) {
                                    if (!['doctype', 'name', 'parent', 'parentfield', 'parenttype'].includes(field)) {
                                        new_row[field] = row[field];
                                    }
                                }
                                lead_doc.custom_bill_of_quantity.push(new_row);
                            }
                        });

                        // Save the updated Lead
                        frappe.call({
                            method: 'frappe.client.save',
                            args: {
                                doc: lead_doc
                            },
                            callback: function(save_response) {
                                frappe.msgprint(__('Data from Sub BOQ has been successfully mapped to Lead: ') + lead_doc.name);
                            },
                            error: function(err) {
                                frappe.msgprint(__('An error occurred while saving the Lead.'));
                                console.error(err);
                            }
                        });
                    }
                });
            },
            error: function(err) {
                frappe.msgprint(__('An error occurred while fetching the Lead.'));
                console.error(err);
            }
        });
    }
});

frappe.ui.form.on('Sub BOQ', {
    onload: function(frm) {
        console.log('Onload Event Triggered');
        console.log('Floor Level:', frm.doc.floor_level);
        console.log('Room Name:', frm.doc.room_name);

        // Use grid.on('row_created') to ensure values are set when a row is created
        frm.fields_dict['bill_of_quantity'].grid.on('row_created', function(e, row) {
            console.log('Row Created');
            
            // Ensure parent values are available
            var parent_value_1 = frm.doc.floor_level; // Correct parent field
            var parent_value_2 = frm.doc.room_name; // Correct parent field
            console.log('Mapped Values:', parent_value_1, parent_value_2);
            
            // Set values in the newly created row
            row.set_value('floor_level', parent_value_1); // Set child field value
            row.set_value('child_field_2', parent_value_2); // Set child field value
        });

        // Also log whenever rows are inserted
        frm.fields_dict['bill_of_quantity'].grid.on('row_inserted', function(e, row) {
            console.log('Row Inserted');
        });
    }
});



