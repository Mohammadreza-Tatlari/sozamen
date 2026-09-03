import {redirect} from "next/navigation";import {getUser} from "@/lib/auth/session";import {ProductForm} from "@/components/admin/ProductForm";
export default async function NewProduct(){const u=await getUser();if(u?.role!=="admin")redirect("/");return <ProductForm/>}
