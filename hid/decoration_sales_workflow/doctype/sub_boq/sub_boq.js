
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
        // frm.add_custom_button(__('Update Margins'), function() {
        //     frm.doc.bill_of_quantity.forEach(row => {
        //         calculateMargins(frm, row.doctype, row.name);
        //     });
        //     frm.save();
        // });
        
        
        // frm.add_custom_button(__('Initiate Pricing Request'), function() {
        //     createMaterialRequest(frm);
        // });

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
    // custom_update_margin: function(frm) {
    //     console.log("custom_update_margin event triggered");
    //     frm.doc.bill_of_quantity.forEach(row => {
    //         calculateMargins(frm, row.doctype, row.name);
    //     });
    //     frm.save();
    // },
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
        frm.add_custom_button(('Auto Fill'), function () {
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

// frappe.ui.form.on('Sub BOQ', {
//     refresh: function (frm) {
//         // Add the custom button for mapping rows to Lead
//         frm.add_custom_button(__('Map to Lead'), function () {
//             frm.trigger('map_to_lead'); // Trigger the mapping process when the button is clicked
//         });
//     },

//     map_to_lead: function (frm) {
//         // Validate that there is a project_name set on the form
//         if (!frm.doc.project_name) {
//             frappe.msgprint(__('Please ensure the Project Name is filled.'));
//             return;
//         }

//         // Get the list of Lead records where the custom_project_name matches
//         frappe.call({
//             method: 'frappe.client.get_list',
//             args: {
//                 doctype: 'Lead',
//                 filters: {
//                     custom_project_name: frm.doc.project_name  // Filter by project_name field in Lead
//                 },
//                 fields: ['name']
//             },
//             callback: function(response) {
//                 const lead_records = response.message;

//                 // If no Lead record is found, show an error
//                 if (lead_records.length === 0) {
//                     frappe.msgprint(__('No Lead record found for the given Project Name.'));
//                     return;
//                 }

//                 // Get the name of the first Lead record
//                 const lead_name = lead_records[0].name;

//                 // Get the full Lead document to map the Sub BOQ rows
//                 frappe.call({
//                     method: 'frappe.client.get',
//                     args: {
//                         doctype: 'Lead',
//                         name: lead_name
//                     },
//                     callback: function(lead_response) {
//                         const lead_doc = lead_response.message;

//                         // Initialize counter for successfully mapped rows
//                         let mapped_count = 0;

//                         // Loop through each row in the Sub BOQ table
//                         frm.doc.bill_of_quantity.forEach((row) => {
//                             if (row.hid_code) { // Only map rows with hid_code populated
//                                 // Copy this row into the Lead's custom_bill_of_quantity
//                                 lead_doc.custom_bill_of_quantity.push({
//                                     "item": row.item,
//                                     "hid_code": row.hid_code,
//                                     "quantity": row.quantity,
//                                     "unit": row.unit,
//                                     "room_name": row.room_name,
//                                     "supplier": row.supplier
//                                 });
//                                 mapped_count++; // Increment the counter for mapped rows
//                             }
//                         });

//                         // If any rows were mapped, save the Lead document and show a success message
//                         if (mapped_count > 0) {
//                             frappe.call({
//                                 method: 'frappe.client.save',
//                                 args: {
//                                     doc: lead_doc
//                                 },
//                                 callback: function() {
//                                     frappe.msgprint(`${mapped_count} rows have been successfully mapped to Lead: ${lead_name}`);
//                                 },
//                                 error: function(err) {
//                                     frappe.msgprint(__('An error occurred while saving the Lead.'));
//                                     console.error(err);
//                                 }
//                             });
//                         } else {
//                             frappe.msgprint(__('No rows were mapped because none of the rows had an HID Code.'));
//                         }
//                     },
//                     error: function(err) {
//                         frappe.msgprint(__('An error occurred while fetching the Lead details.'));
//                         console.error(err);
//                     }
//                 });
//             },
//             error: function(err) {
//                 frappe.msgprint(__('An error occurred while fetching the Lead list.'));
//                 console.error(err);
//             }
//         });
//     }
// });
frappe.ui.form.on('Sub BOQ', {
    refresh: function(frm) {
        frm.add_custom_button(__('Map to Lead'), function () {
            frm.trigger('map_to_lead');
        });
    },

    map_to_lead: function(frm) {
        if (!frm.doc.project_name) {
            frappe.msgprint(__('Please ensure the Project Name is filled.'));
            return;
        }

        // Fetch the Lead records based on project_name
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Lead',
                filters: { custom_project_name: frm.doc.project_name },
                fields: ['name']
            },
            callback: function (response) {
                const lead_records = response.message;

                if (lead_records.length === 0) {
                    frappe.msgprint(__('No Lead record found for the given Project Name.'));
                    return;
                }

                const lead_name = lead_records[0].name;

                frappe.call({
                    method: 'frappe.client.get',
                    args: { doctype: 'Lead', name: lead_name },
                    callback: function (lead_response) {
                        const lead_doc = lead_response.message;
                        let mapped_count = 0;

                        // Get the current rows from the Lead's child table (custom_bill_of_quantity)
                        const child_table_length = lead_doc.custom_bill_of_quantity ? lead_doc.custom_bill_of_quantity.length : 0;

                        // Iterate through the Sub BOQ's Bill of Quantity rows to map to Lead
                        frm.doc.bill_of_quantity.forEach((row, index) => {
                            if (row.hid_code) {
                                let mapped_row = {};

                                // Ensure no overwriting happens by manually mapping each field
                                Object.keys(row).forEach((key) => {
                                    if (key !== "__idx" && key !== "__hash") {
                                        mapped_row[key] = row[key];
                                    }
                                });

                                // Set a new unique index for this row in the Lead document
                                mapped_row.__idx = child_table_length + mapped_count;  // Correct index order

                                // Add the new row to the Lead's child table without affecting Sub BOQ's table
                                lead_doc.custom_bill_of_quantity.push(mapped_row);
                                mapped_count++;
                            }
                        });

                        // If there are any mapped rows, save the Lead document with updated child rows
                        if (mapped_count > 0) {
                            frappe.call({
                                method: 'frappe.client.save',
                                args: {
                                    doc: lead_doc
                                },
                                callback: function () {
                                    frappe.msgprint(`${mapped_count} rows successfully mapped to Lead: ${lead_name}`);
                                },
                                error: function (err) {
                                    frappe.msgprint(__('Error while saving the Lead.'));
                                    console.error(err);
                                }
                            });
                        } else {
                            frappe.msgprint(__('No rows were mapped because none of the rows had an HID Code.'));
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
