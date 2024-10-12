// public/js/Generate Codes.js

// Function to create items from BoQ
async function createItemsFromBoQ(frm) {
    console.log("createItemsFromBoQ function called");
    let items_created = 0;
    let items_skipped = 0;
    let items_updated = 0;
    const processedItemCodes = new Set();

    async function checkItemExists(hid_code) {
        try {
            return await frappe.db.exists('Item', hid_code);
        } catch (err) {
            console.error(`Error checking item existence with hid_code "${hid_code}":`, err);
            throw err;
        }
    }

    async function getItem(hid_code) {
        try {
            return await frappe.db.get_doc('Item', hid_code);
        } catch (err) {
            console.error(`Error retrieving item with hid_code "${hid_code}":`, err);
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
                items_updated++;
                processedItemCodes.add(item_code);

                frm.doc.custom_bill_of_quantity.forEach(row => {
                    if (row.hid_code === item_code) {
                        frappe.model.set_value(row.doctype, row.name, 'is_created', 1);
                        frappe.model.set_value(row.doctype, row.name, 'product_code', item_code);
                    }
                });
            } else {
                console.error(`Error updating item with hid_code "${item_code}":`, response.message);
                frappe.msgprint(`Error updating item with hid_code "${item_code}": ${response.message}`);
            }
        } catch (err) {
            console.error(`Error updating item with hid_code "${item_code}":`, err);
            frappe.msgprint(`Error updating item with hid_code "${item_code}": ${err.message || 'Unknown error'}`);
        }
    }

    async function createItem(itemData) {
        console.log("createItem function called for", itemData.item_code);
        const item_doc = frappe.model.get_new_doc('Item');
        Object.assign(item_doc, itemData);

        try {
            const new_item = await frappe.db.insert(item_doc);
            items_created++;
            processedItemCodes.add(itemData.item_code);

            frm.doc.custom_bill_of_quantity.forEach(row => {
                if (row.hid_code === itemData.item_code) {
                    frappe.model.set_value(row.doctype, row.name, 'is_created', 1);
                    frappe.model.set_value(row.doctype, row.name, 'product_code', new_item.item_code);
                }
            });
        } catch (err) {
            console.error(`Error creating item with hid_code "${itemData.item_code}":`, err);
            items_skipped++;
            frappe.msgprint(`Error creating item with hid_code "${itemData.item_code}": ${err.message || 'Unknown error'}`);
        }
    }

    for (const row of frm.doc.custom_bill_of_quantity) {
        if (row.hid_code && row.product_name && row.uom) {
            if (processedItemCodes.has(row.hid_code)) {
                items_skipped++;
                continue;
            }

            try {
                const exists = await checkItemExists(row.hid_code);
                const itemData = {
                    item_code: row.hid_code,
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
                    custom_boq_item: row.name
                };

                if (exists) {
                    const existingItem = await getItem(row.hid_code);

                    // Check for any differences between existing item and the current row data
                    let isModified = false;
                    for (const key in itemData) {
                        if (itemData[key] !== existingItem[key]) {
                            isModified = true;
                            break;
                        }
                    }

                    if (isModified) {
                        await updateItem(row.hid_code, itemData);
                    } else {
                        items_skipped++;
                        console.log(`No changes detected for item with hid_code "${row.hid_code}".`);
                    }
                } else {
                    await createItem(itemData);
                }
            } catch (err) {
                console.error(`Error processing item with hid_code "${row.hid_code}":`, err);
                items_skipped++;
            }
        }
    }

    // Save the document after processing all items
    try {
        await frm.save();
        frappe.msgprint(`Items creation process completed. Created: ${items_created}, Updated: ${items_updated}, Skipped: ${items_skipped}`);
    } catch (err) {
        console.error('Error saving document:', err);
        frappe.msgprint('There was an issue saving the document.');
    }
}



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
