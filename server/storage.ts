import { type Order, type InsertOrder } from "@shared/schema";
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// --- HARDCODED CONFIGURATION ---
const SPREADSHEET_ID = "1FtVFv0QBzmoMSFpV4EjFvZRoaLBysF_JfU7IBy9oQZk";

const serviceAccountAuth = new JWT({
  email: "newoltdb@newolt-db.iam.gserviceaccount.com",
  key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDprErd5K7LqUi/\nJcZBnSxXA1FUHOodjlxc85m5ZJXFgYYwXV/0cWUVHEK4+/2ynwBhWZ7bjlDC76J5\ngxJ+9wvK4J3LhOpRGwKma0Yrl03G595dh3pzr/+n6y3TWsj3CCSiYMPpcUYN6Fq6\nDywe6F8dWN91MY6xmAAB9gF7NJK8EO+7MKruvDxn/e+T1LaI59zHEkriNV44yh01\nVHIPJ1rTLhL7bP2lqjpm8gHacprKrW+2HNtOCKLjuePY+ivOU8XDPZmjoIBKXj3O\n94blXgNQKGBKT0f8e9t5ca7zEACdz9JYM4LAfnuCxFJpJdWaK575KJzcxKtnC90u\n5pXjDyt9AgMBAAECggEAAhDzcoXYo9Vh3srTN3ZP048kc3Vz/oHpQCspQ1Hn3yC3\nkoro080C405mKqOTyTYNt06nEHLwNOEQkzl8+uFtWcRlsMyCk+gEvHr7WlxSpD0d\nor8VbptyS8ZRF+rYFxMb29G2OcS2JV5WGwoSTk2otaY5B5zCEcDx0xKdTb0XxRDu\n8d+FTNLH174zwU7xfCEDBhl/bxbRGdtAI5FBywZdBIZlZmvuM4CK0tsATaVO/8WO\nL1+xVyYiwLOe0FIE2pRgS39gWH78Ezy7yCyhaIW+2tPsI1aQJITVD4YDvw8DytPl\nvoIcqZl7Qg2uCgHAy/rzs1Iosz8NVqyOEtRGmJo6wQKBgQD8fFbnSA1uYOp1dXrY\n1JpTTT9FsxlVwiyFVMoCqLllkVrYWDYDRc07Anry8PlCg0jPkHdpQ9WfsWB9vsoZ\ner5NmKd/tAupAJJUR3Qu0WrwnDHLTapjhRNAkuv7I8wJRyF7l5hdEp7rZjjXP1xt\n07XKByImNM4nHn1aBa60xaevYQKBgQDs7Otbr3t8u7xzfMzQo/WPK2b+vXdktvUQ\nVlDY2zS7NwpC5AHpngs9ECqQSGcrLxJ6L9xZl5KybSjMZVxkOr5jPRCJwe8mQ+rT\ns/LaG9VO+IjR1a4tiqLh3d/sUpLi3caamq2gLJhIFtRUpcrRQLfLjEL5rglBCTYN\nCpUfrX69nQKBgQC3SixsSco2TvTlwBsmPXCq+HDuUE4cC5H2WM8tjv7H1PV2CNNt\nHMcYB3zp0DWjK1s4E1AcgroZ69J4doCQbqKoAiHWewXb8iZIOHcHZc+UTE95nzAK\nfxiyz/WvoxUDxzdvWWWqa1Ii4VpyJ/UZZY+a0gLgaYUesOue5nElmjdZAQKBgEV/\nWaqTVw3HpAfcW9f3wFg2ywd+XD9Wy5v3Nc/mvRkNlBz69PSqP3GyBEo+csTgEfN1\nhpVhOM7N5mHOecOM17wUdX1zPctjsMZYyqvf7joz/S5QF7+UIyNOChkwP5X8p/1B\n0hxh+GltCOurlkq7SS6T/jFvM5e4M/qvV/7qzXqhAoGAAb/ho/Ja058l1HBjLAUI\nW5Jj3EziqtwFaVqC3ptr8kzZQX8Qaw9GYjeQO9IoQicKgsHF+LfzPFSy8E9ZmJ/I\n7UCo9/YuvUIpNcDtjppyy1kc+l62w9Gz82jOdEjGj31fGfkSW1Q5mRAreZZ0MovM\nEt/lVlOVZFRxgCx1wq/kEoY=\n-----END PRIVATE KEY-----",
  scopes: ['https://www.googleapis.com/spreadsheets'],
});

export interface IStorage {
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
}

export class SheetStorage implements IStorage {
  private doc: GoogleSpreadsheet;

  constructor() {
    this.doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  }

  async getOrders(): Promise<Order[]> {
    await this.doc.loadInfo();
    const sheet = this.doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    return rows.map(row => ({
      id: row.get('id'),
      tableNo: parseInt(row.get('tableNo')),
      customerName: row.get('customerName'),
      status: row.get('status'),
      totalPrice: parseFloat(row.get('totalPrice')),
      paymentMethod: row.get('paymentMethod'),
      createdAt: new Date(row.get('createdAt')),
      items: JSON.parse(row.get('items') || "[]"),
    })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const orders = await this.getOrders();
    return orders.find(o => o.id === id);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    await this.doc.loadInfo();
    const sheet = this.doc.sheetsByIndex[0];
    
    const newOrder: Order = {
      ...insertOrder,
      id: Math.random().toString(36).substr(2, 9),
      status: insertOrder.status || "pending",
      createdAt: new Date(),
    };

    await sheet.addRow({
      id: newOrder.id,
      tableNo: newOrder.tableNo,
      customerName: newOrder.customerName,
      status: newOrder.status,
      totalPrice: newOrder.totalPrice,
      paymentMethod: newOrder.paymentMethod,
      createdAt: newOrder.createdAt.toISOString(),
      items: JSON.stringify(newOrder.items),
    });

    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    await this.doc.loadInfo();
    const sheet = this.doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    const row = rows.find(r => r.get('id') === id);
    if (row) {
      row.set('status', status);
      await row.save();
      
      const order = await this.getOrder(id);
      return order;
    }
    return undefined;
  }
}

export const storage = new SheetStorage();
