app_name = "hid"
app_title = "Decoration Sales Workflow"
app_publisher = "unclee919@gmail.com"
app_description = "Sales for decoration company"
app_email = "unclee919@gmail.com"
app_license = "gpl-3.0"

# Includes in <head>
app_include_js = [
    "/assets/hid/js/hid.bundle.js" # Ensure this is the correct path for your new JS file
    "/assets/hid/js/Generate Codes.js",
    "/assets/hid/js/ROQ.js" ,
    "/assets/hid/js/Supplier quotation.js"#
]

web_include_js = [
    "/assets/hid/js/Generate Codes.js",
    "/assets/hid/js/ROQ.js" , 
    "/assets/js/Supplier quotation.js"# Ensure this is the correct path for your new JS file
]

# Add custom scripts to specific forms
doctype_js = {
    "Lead": "public/js/Generate Codes.js",
    "Material Request": "public/js/ROQ.js", 
    "Supplier Quotation": "public/js/ROQ.js" # Link ROQ.js to Material Request Doctype
    # Add other Doctypes and their corresponding JS files if needed
    # Example: "Your Doctype": "public/js/YourScript.js"
}