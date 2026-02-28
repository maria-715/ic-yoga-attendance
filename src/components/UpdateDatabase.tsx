import { doc, DocumentReference, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { db } from "../../firestore/firebaseConfig";
import { MONTH_NEW_ACADEMIC_YEAR, ID_10_CLASS_PASS, ID_SINGLE_CLASS_MEMBER, ID_SINGLE_CLASS_NON_MEMBER, ID_MEMBERSHIP, StatusClassPass, fromStatusClassPassToString, LINE_ID_MEMBERSHIP } from "../global";
import { changeLastUpdated, getLastUpdated } from "../../firestore/general";

// TODO: add try/catch blocks

// Useful for catching from the Union API

interface Customer {
  FirstName: string;
  Surname: string;
  CID: string;
  Email: string;
  Login: string;
}

interface VAT {
  Code: string;
  Name: string;
  Rate: number;
}

interface Sale {
  OrderNumber: string;
  SaleDateTime: string;
  ProductID: number;
  ProductLineID: number;
  Price: number;
  Quantity: number;
  QuantityCollected: number;
  Customer: Customer;
  VAT: VAT;
}



async function addCustomerIfNotExists(sale: Sale, orderRef: DocumentReference) {

  const customer = sale.Customer;
  const isMember = (sale.ProductID == ID_MEMBERSHIP) && (sale.ProductLineID == LINE_ID_MEMBERSHIP);

  if (customer.Login == null || customer.Login == "") {
    return;
  }

  const customerRef = doc(db, "users", customer.Login);

  // Check if the customer already exists in Firestore
  const customerSnapshot = await getDoc(customerRef);

  if (customerSnapshot.exists()) {

    // TODO: if deciding to use the isMember field:
    // Here, make them a member if they are buying a yoga membership

    // TODO: see if this version using arrayUnion works instead
    // await updateDoc(customerRef, {
    //   orders: arrayUnion(orderRef)
    // });

    const orders = customerSnapshot.data().orders;

    if (!orders.some((ref: DocumentReference) => ref.path === orderRef.path)) {
      orders.push(orderRef)

      await updateDoc(customerRef, {orders: orders});
    }
    return;

  } else { // Not an existing customer
  
    try {
      await setDoc(customerRef, {
        cid: customer.CID,
        login: customer.Login,
        firstName: customer.FirstName,
        surname: customer.Surname,
        email: customer.Email,
        isMember: isMember, //TODO
        orders: [orderRef],
      });

    } catch (error) {
      console.error(`Error adding customer with login: ${customer.Login} `, error);
    }
  }

}


async function addSaleIfNotExists(sale: Sale) {

  const orderRef = doc(db, "orders", sale.OrderNumber);

  // Check if the order already exists in Firestore
  const orderSnapshot = await getDoc(orderRef);

  if (orderSnapshot.exists()) {
    return;

  } else {
  
    try {

      let numTotal = 1;
      let classes: {yogaClass: DocumentReference, ticked: boolean}[] = [];
      let productId = sale.ProductID;
      let productLineId = sale.ProductLineID;
      let statusClassPass = StatusClassPass.NotApplicable;

      // If 10-class pass
      if (sale.ProductID === ID_10_CLASS_PASS) {
        numTotal = 10;
        statusClassPass = StatusClassPass.InUse;
      }

      // If membership order
      if (sale.ProductID === ID_MEMBERSHIP) {
        numTotal = 0;
      }

      await setDoc(orderRef, {
        numTotal: numTotal,
        classes: classes,
        productId: productId,
        productLineId: productLineId,
        statusClassPass: fromStatusClassPassToString(statusClassPass)
      });

    } catch (error) {
      console.error(`Error adding sale with login: ${sale.OrderNumber} `, error);
    }
  }

  try {
    await addCustomerIfNotExists(sale, orderRef);
  } catch (error) {
    console.error(`Error adding customer with order number ${sale.OrderNumber}: `, error);
  }
}


// Will modify the order number of the sale if the purchased quantity is higher than 1
async function addPurchaseIfNotExists(sale: Sale) {


  if (sale.Quantity > 1) {

    // Creating a new sale by modifying the order number and quantity
    for (let i = 1; i <= sale.Quantity; ++i) {

      const saleCopy: Sale = {
        ...sale,
        OrderNumber: `${sale.OrderNumber}n${i}`, // "n" like "number"
        Quantity: 1,
      };

      await addSaleIfNotExists(saleCopy);

    }

  } else {
    await addSaleIfNotExists(sale);
  }

}


export function UpdateDatabase() {
  const [loading, setLoading] = useState(false);

  const baseUrl = "http://localhost:8080/proxy";
  
  const date = new Date();
  const fullYear = date.getFullYear();
  const month = date.getMonth();
  let year;
  if (month < MONTH_NEW_ACADEMIC_YEAR) {
    year = `${(fullYear-1)%100}-${(fullYear)%100}`;
  } else {
    year = `${(fullYear)%100}-${(fullYear+1)%100}`;
  }

  const handleUpdate = async () => {
    setLoading(true);

    let lastUpdated;
    try {

      // ======================== Get when the database was last updated =========================
      lastUpdated = await getLastUpdated();

      if (!lastUpdated) {
        throw Error("lastUpdated doesn't exist on Firestore");
      }

    } catch (error) {
      console.error("Error fetching when the database was last updated:", error);
      setLoading(false);
    }
  


    try {

      // ========================== Updating products (even for non-members) ============================

      const productsYearUrl = `${baseUrl}/products?year=${year}`;

      const response = await fetch(productsYearUrl);

      if (!response.ok) {
        throw new Error(`HTTP error for products with status: ${response.status}`);
      }
      let products = await response.json();

      if (products.length > 0) {
        products = products.map((product: any) => {
          return product.ID;
        });
      }

      // Products that are NOT from the current year but that are still being sold
      products.push(ID_10_CLASS_PASS);
      products.push(ID_SINGLE_CLASS_MEMBER);
      products.push(ID_SINGLE_CLASS_NON_MEMBER);

      for (const productId of products) {

        try {

          const url = `${baseUrl}/products/${Number(productId)}/sales`;
          const response = await fetch(url);
  
          if (!response.ok) {
            throw new Error(`HTTP error for a specific product with status: ${response.status}`);
          }
          const sales: Sale[] = await response.json();
  
          for (const sale of sales) {

            // Checking that the sell has been done after the last update
            const saleDate = new Date(sale.SaleDateTime);

            const lastUpdatedDate = new Date(lastUpdated.replace(' ', 'T'));
            const isAfterLastUpdate = saleDate > lastUpdatedDate;

            if (isAfterLastUpdate) {

                  await addPurchaseIfNotExists(sale);
            }
          }

          await changeLastUpdated();
          
        } catch (error) {
          console.error("Error fetching sales:", error);
          setLoading(false);
        }

      }
      

    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleUpdate}
      disabled={loading}
      className="text-white"
    >
      {loading ? "Updating..." : "Update"}
    </button>
  );
}
