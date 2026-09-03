import {redirect} from "next/navigation";import {getUser} from "@/lib/auth/session";import {CheckoutForm} from "@/components/cart/CheckoutForm";
export default async function Checkout(){const user=await getUser();if(!user)redirect("/login?next=/checkout");return <CheckoutForm user={{name:user.name,phone:user.phone,address:user.address}}/>}
